import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AcaoAuditoria, StatusCadastroCliente, StatusPagamentoFatura } from '@prisma/client';
import { toDecimal } from '../armazenagem-faturamento/armazenagem-billing.util';
import { AlertService } from '../alert/alert.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { BankingBoletoService } from '../fiscal-integracao/banking-boleto.service';
import { FiscalNfseRouterService } from '../fiscal-integracao/fiscal-nfse-router.service';
import { FEATURE_FLAG_KEYS } from '../feature-flags/feature-flag.keys';
import { FeatureFlagService } from '../feature-flags/feature-flag.service';
import { NotificationEnqueueService } from '../notification/notification-enqueue.service';
import { PrismaService } from '../prisma/prisma.service';
import { IntegrationCredentialsService } from '../tenant/integration-credentials.service';
import { TenantConfigService } from '../tenant/tenant-config.service';
import { DEFAULT_TENANT_ID } from '../tenant/tenant.constants';
import { prazoEfetivoCadastro } from '../cadastro-financeiro/cadastro-operacao-inicial';
import { montarParcelasFinanceiras, type ParcelaFinanceira } from '../cadastro-financeiro/prazo-parcelas.util';

export type EmitirNfseBoletoPayload = {
  faturaId: string;
  preFaturaId: string;
  clienteId: string;
  containerIso: string;
  valorTotal: number;
  gateInAt: string;
  gateOutAt: string;
  diasCobrados: number;
};

@Injectable()
export class NfseBoletoOutboxProcessor {
  private readonly logger = new Logger(NfseBoletoOutboxProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly fiscal: FiscalNfseRouterService,
    private readonly banking: BankingBoletoService,
    private readonly flags: FeatureFlagService,
    private readonly notificationEnqueue: NotificationEnqueueService,
    private readonly tenantConfig: TenantConfigService,
    private readonly credenciais: IntegrationCredentialsService,
    private readonly config: ConfigService,
    private readonly alerts: AlertService,
  ) {}

  async processEmitirNfseBoleto(outboxId: string, raw: unknown): Promise<void> {
    const payload = raw as EmitirNfseBoletoPayload;
    if (!payload?.faturaId || !payload?.clienteId) {
      throw new Error('Payload EMITIR_NFSE_BOLETO inválido');
    }

    const dup = await this.prisma.auditoria.findFirst({
      where: {
        tabela: 'faturas_armazenagem',
        usuario: 'system:armazenagem-nfse',
        dadosDepois: { path: ['outboxId'], equals: outboxId },
      },
    });
    if (dup) {
      this.logger.log(`Outbox ${outboxId} já processado (idempotência)`);
      return;
    }

    const fatura = await this.prisma.fatura.findUnique({
      where: { id: payload.faturaId },
      include: { preFatura: true, cliente: true },
    });
    if (!fatura) throw new Error(`Fatura ${payload.faturaId} não encontrada`);

    if (fatura.statusPagamento === StatusPagamentoFatura.AGUARDANDO_PAGAMENTO) {
      this.logger.log(`Fatura ${fatura.id} já em AGUARDANDO_PAGAMENTO`);
      return;
    }

    // Guarda contra emissão em dobro: a chamada à prefeitura e ao banco acontece
    // antes da transação que grava o resultado. Se já existe nota ou boleto para
    // esta fatura, o evento é reconciliado em vez de reemitido.
    const jaEmitido = await this.reconciliarSeJaEmitida(fatura.id, fatura.faturamentoId, outboxId);
    if (jaEmitido) return;

    const fiscalEnabled = await this.flags.isEnabled(FEATURE_FLAG_KEYS.FISCAL_INTEGRATION_ENABLED, {
      cnpj: fatura.cliente.cpfCnpj,
      tenantId: fatura.tenantId,
    });
    if (!fiscalEnabled) {
      await this.prisma.fatura.update({
        where: { id: fatura.id },
        data: {
          statusPagamento: StatusPagamentoFatura.PENDENTE,
          processamentoErro:
            'Integração fiscal em contingência (FISCAL_INTEGRATION_ENABLED off). Fatura persistida; emissão adiada.',
        },
      });
      await this.auditoria.registrar({
        tabela: 'faturas_armazenagem',
        registroId: fatura.id,
        acao: AcaoAuditoria.UPDATE,
        usuario: 'system:armazenagem-nfse',
        dadosDepois: {
          outboxId,
          modo: 'contingencia_fiscal',
          statusPagamento: StatusPagamentoFatura.PENDENTE,
        },
      });
      this.logger.warn(
        `FISCAL_INTEGRATION_ENABLED off — fatura ${fatura.id} persistida, emissão IPM ignorada (graceful degradation)`,
      );
      return;
    }

    const certOk = await this.assertCertificadoA1(fatura.tenantId);
    if (!certOk && this.fiscal.usesRealIpm()) {
      this.logger.warn(
        `Certificado A1 não configurado para tenant ${fatura.tenantId} — sandbox fallback`,
      );
      await this.alerts.fiscalIpmDown({
        reason: `Tenant ${fatura.tenantId} sem certificado A1 (staging/produção)`,
      });
    }

    await this.prisma.fatura.update({
      where: { id: fatura.id },
      data: { statusPagamento: StatusPagamentoFatura.PROCESSANDO, processamentoErro: null },
    });

    const gateOutAt = new Date(payload.gateOutAt);
    const ctx = {
      containerIso: payload.containerIso,
      diasCobrados: payload.diasCobrados,
      gateOutAt,
      outboxId,
    };

    let fiscalResult;
    let boletoResults;
    try {
      const valorTotal = Number(fatura.valorTotal);
      const [emissaoFiscal, parcelas] = await Promise.all([
        this.fiscal.emitirParaFatura(fatura, fatura.cliente, ctx),
        this.obterParcelasCliente(fatura.cliente, gateOutAt, valorTotal),
      ]);
      fiscalResult = emissaoFiscal;
      if (parcelas.length) {
        boletoResults = [];
        for (const parcela of parcelas) {
          const registrado = await this.banking.registrarBoleto(fatura, fatura.cliente, {
            ...ctx,
            diasVencimento: parcela.dias,
            vencimento: parcela.vencimento,
            valor: parcela.valor,
            parcela: { indice: parcela.indice, total: parcela.totalParcelas },
          });
          boletoResults.push({ ...registrado, valor: parcela.valor });
        }
      } else {
        const registrado = await this.banking.registrarBoleto(fatura, fatura.cliente, ctx);
        boletoResults = [{ ...registrado, valor: valorTotal }];
      }
    } catch (e) {
      await this.prisma.fatura.update({
        where: { id: fatura.id },
        data: {
          statusPagamento: StatusPagamentoFatura.PENDENTE,
          processamentoErro: (e as Error).message?.slice(0, 2000) ?? 'Erro fiscal/bancário',
        },
      });
      throw e;
    }

    if (!boletoResults?.length) {
      throw new Error('Falha ao registrar boleto');
    }

    const periodo = `${gateOutAt.getFullYear()}-${String(gateOutAt.getMonth() + 1).padStart(2, '0')}`;
    const valorTotal = Number(fatura.valorTotal);
    const descricao = `Armazenagem — ${payload.containerIso} (${payload.diasCobrados} dia(s) após free time)`;

    const nfsePendente = fiscalResult.mode === 'pendente';
    const linkNfse =
      fiscalResult.mode === 'emitida' ? fiscalResult.linkNfse : undefined;
    const statusFinal =
      nfsePendente
        ? StatusPagamentoFatura.PROCESSANDO
        : StatusPagamentoFatura.AGUARDANDO_PAGAMENTO;

    const { faturamentoId, numeroBoleto } = await this.prisma.$transaction(async (tx) => {
      let faturamento = await tx.faturamento.findUnique({
        where: { clienteId_periodo: { clienteId: payload.clienteId, periodo } },
      });

      if (faturamento) {
        faturamento = await tx.faturamento.update({
          where: { id: faturamento.id },
          data: {
            valorTotal: faturamento.valorTotal.add(toDecimal(valorTotal)),
            statusNfe: nfsePendente ? 'processando' : 'emitida',
            statusBoleto: 'pendente',
            itens: { create: { descricao, valor: toDecimal(valorTotal) } },
          },
        });
      } else {
        faturamento = await tx.faturamento.create({
          data: {
            clienteId: payload.clienteId,
            periodo,
            valorTotal: toDecimal(valorTotal),
            statusNfe: nfsePendente ? 'processando' : 'emitida',
            statusBoleto: 'pendente',
            itens: { create: { descricao, valor: toDecimal(valorTotal) } },
          },
        });
      }

      const numeroNfe =
        fiscalResult.mode === 'emitida'
          ? fiscalResult.numeroNfse
          : `RPS-${fiscalResult.rpsNumero}-${Date.now()}`;

      await tx.nfsEmitida.create({
        data: {
          faturamentoId: faturamento.id,
          numeroNfe,
          xmlNfe: fiscalResult.xmlResposta,
          statusIpm: nfsePendente ? 'PROCESSANDO' : 'ACEITO',
          municipioIbge: '4211306',
          provedor:
            fiscalResult.provedor === 'nacional'
              ? 'nfse-nacional'
              : this.fiscal.usesRealIpm()
                ? 'ipm-atende-navegantes'
                : 'sandbox',
          referenciaExterna:
            fiscalResult.mode === 'emitida'
              ? fiscalResult.codVerificador ?? fiscalResult.numeroNfse
              : fiscalResult.codVerificador ?? `RPS-${fiscalResult.rpsNumero}`,
          linkNfsePdf: linkNfse ?? null,
          rpsNumero: fiscalResult.rpsNumero,
          rpsSerie: fiscalResult.rpsSerie,
        },
      });

      for (const boleto of boletoResults) {
        await tx.boleto.create({
          data: {
            faturamentoId: faturamento.id,
            numeroBoleto: boleto.numeroBoleto,
            dataVencimento: boleto.dataVencimento,
            valorBoleto: toDecimal(boleto.valor),
            valorAtualizado: toDecimal(boleto.valor),
            statusPagamento: 'pendente',
            linkPdf: boleto.linkPdf,
            pixCopiaCola: boleto.pixCopiaCola,
            pixQrCodeUrl: boleto.pixQrCodeUrl,
            provedor: boleto.provedor,
            referenciaExterna: boleto.referenciaExterna,
          },
        });
      }

      const primeiro = boletoResults[0]!;
      await tx.fatura.update({
        where: { id: fatura.id },
        data: {
          faturamentoId: faturamento.id,
          dataVencimento: primeiro.dataVencimento,
          valorAtualizado: toDecimal(valorTotal),
          linkNfse: linkNfse ?? null,
          linkBoleto: primeiro.linkPdf,
          linkPix: primeiro.pixQrCodeUrl || primeiro.pixCopiaCola,
          numeroRps: fiscalResult.rpsNumero,
          serieRps: fiscalResult.rpsSerie,
          statusPagamento: statusFinal,
          processamentoErro: null,
        },
      });

      return {
        faturamentoId: faturamento.id,
        numeroBoleto: boletoResults.map((b) => b.numeroBoleto).join(','),
      };
    });

    await this.auditoria.registrar({
      tabela: 'faturas_armazenagem',
      registroId: fatura.id,
      acao: AcaoAuditoria.INSERT,
      usuario: 'system:armazenagem-nfse',
      dadosDepois: {
        outboxId,
        faturamentoId,
        linkNfse,
        linkBoleto: boletoResults[0]?.linkPdf,
        linkPix: boletoResults[0]?.pixQrCodeUrl,
        numeroBoleto,
        parcelas: boletoResults.length,
        nfsePendente,
        valorTotal,
      },
    });

    this.logger.log(
      `EMITIR_NFSE_BOLETO outbox ${outboxId}: fatura ${fatura.id} → ${statusFinal}${nfsePendente ? ' (NFS-e polling)' : ''}`,
    );

    if (statusFinal === StatusPagamentoFatura.AGUARDANDO_PAGAMENTO) {
      await this.notificationEnqueue.enqueueFinanceiroStandalone({
        faturaId: fatura.id,
        clienteId: payload.clienteId,
        containerIso: payload.containerIso,
        valorTotal,
        dedupeKey: `financeiro:${outboxId}`,
      });
    }
  }

  /** Calendário de boletos do prazo efetivo (pendente opera à vista). */
  private async obterParcelasCliente(
    cliente: {
      prazoPagamento: string | null;
      tenantId: string;
      statusCadastro?: StatusCadastroCliente | null;
    },
    emissao: Date,
    valorTotal: number,
  ): Promise<ParcelaFinanceira[]> {
    const prazo = prazoEfetivoCadastro(cliente.statusCadastro, cliente.prazoPagamento);
    if (!prazo) return [];
    const config = await this.prisma.tenantConfig.findFirst({
      where: {
        OR: [
          { tenantId: cliente.tenantId },
          { tenantKey: cliente.tenantId === DEFAULT_TENANT_ID ? 'default' : cliente.tenantId },
        ],
      },
      select: { id: true },
    });
    const row = config
      ? await this.prisma.condicaoPagamentoPersonalizada.findFirst({
          where: { tenantId: config.id, tipo: 'PRAZO', value: prazo, ativo: true },
          select: { vencimentos: true, dias: true },
        })
      : null;
    const vencimentos =
      row?.vencimentos?.length
        ? row.vencimentos
        : row?.dias != null
          ? [row.dias]
          : prazo === 'A_VISTA'
            ? [0]
            : [];
    if (!vencimentos.length) return [];
    return montarParcelasFinanceiras({ emissao, valorTotal, vencimentos });
  }

  /**
   * Reconciliação de retry: se a fatura já tem NFS-e (pelo RPS) ou boleto gravados,
   * o provedor já respondeu antes da falha. Fecha o estado sem emitir de novo.
   */
  private async reconciliarSeJaEmitida(
    faturaId: string,
    faturamentoId: string | null,
    outboxId: string,
  ): Promise<boolean> {
    const fatura = await this.prisma.fatura.findUnique({ where: { id: faturaId } });
    if (!fatura || !faturamentoId) return false;

    const nfse = fatura.numeroRps
      ? await this.prisma.nfsEmitida.findFirst({
          where: {
            faturamentoId,
            rpsNumero: fatura.numeroRps,
            ...(fatura.serieRps ? { rpsSerie: fatura.serieRps } : {}),
          },
        })
      : null;
    const boletos = await this.prisma.boleto.count({ where: { faturamentoId } });

    if (!nfse && !boletos) return false;

    const notaAceita = nfse?.statusIpm === 'ACEITO';
    const destino =
      notaAceita && (boletos > 0 || fatura.linkBoleto)
        ? StatusPagamentoFatura.AGUARDANDO_PAGAMENTO
        : StatusPagamentoFatura.PROCESSANDO;

    await this.prisma.fatura.update({
      where: { id: fatura.id },
      data: {
        statusPagamento: destino,
        ...(nfse?.linkNfsePdf ? { linkNfse: nfse.linkNfsePdf } : {}),
        processamentoErro: null,
      },
    });
    this.logger.warn(
      `Outbox ${outboxId}: fatura ${fatura.id} já tinha ${nfse ? 'NFS-e' : ''}${nfse && boletos ? ' e ' : ''}${boletos ? 'boleto' : ''} — reconciliado como ${destino}, sem reemitir.`,
    );
    return true;
  }

  /**
   * Valida certificado A1: integração IPM do terminal, ficha fiscal antiga
   * ou NFSE_IPM_CERT_PATH do servidor (staging/produção).
   */
  private async assertCertificadoA1(tenantId: string): Promise<boolean> {
    const ipm = await this.credenciais.resolveIpm(tenantId);
    if (ipm.certificadoPresente) return true;
    const { parametros } = await this.tenantConfig.getParametros(tenantId);
    return Boolean(parametros.nfse?.certificadoBase64?.trim());
  }
}
