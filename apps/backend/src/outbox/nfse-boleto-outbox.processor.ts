import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AcaoAuditoria, StatusCadastroCliente, StatusPagamentoFatura } from '@prisma/client';
import { toDecimal } from '../armazenagem-faturamento/armazenagem-billing.util';
import { AlertService } from '../alert/alert.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { BankingBoletoService } from '../fiscal-integracao/banking-boleto.service';
import { FiscalIpmService } from '../fiscal-integracao/fiscal-ipm.service';
import { FEATURE_FLAG_KEYS } from '../feature-flags/feature-flag.keys';
import { FeatureFlagService } from '../feature-flags/feature-flag.service';
import { NotificationEnqueueService } from '../notification/notification-enqueue.service';
import { PrismaService } from '../prisma/prisma.service';
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
    private readonly fiscal: FiscalIpmService,
    private readonly banking: BankingBoletoService,
    private readonly flags: FeatureFlagService,
    private readonly notificationEnqueue: NotificationEnqueueService,
    private readonly tenantConfig: TenantConfigService,
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
          provedor: this.fiscal.usesRealIpm() ? 'ipm-atende-navegantes' : 'sandbox',
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

  /** Valida certificado A1 no tenant ou variável NFSE_IPM_CERT_PATH (staging/produção). */
  private async assertCertificadoA1(tenantId: string): Promise<boolean> {
    const { parametros } = await this.tenantConfig.getParametros(tenantId);
    if (parametros.nfse?.certificadoBase64?.trim()) return true;
    const certPath = this.config.get<string>('nfse.ipm.certPath', { infer: true })?.trim();
    return Boolean(certPath);
  }
}
