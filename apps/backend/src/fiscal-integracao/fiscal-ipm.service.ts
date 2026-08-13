import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import type { Cliente, Fatura, PreFatura } from '@prisma/client';
import { IpmNfseAdapter } from '../nfse/nfse.adapter';
import type { TomadorNfseDto } from '../nfse/dto/emitir-nfse.dto';
import type { EmissaoNfseIpmPayload } from '../nfse/xml/ipm-nfse-xml.builder';
import { RetriableOutboxError } from '../outbox/outbox.errors';
import type { FiscalEmissaoResult } from './fiscal-integracao.types';

const IBGE_TOM: Record<string, string> = {
  '4211306': '8221',
  '4205407': '7071',
  '4209102': '8055',
};

function formatBrDate(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatBrTime(d: Date): string {
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mi = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  return `${hh}:${mi}:${ss}`;
}

function splitPhone(raw: string): { ddd: string; fone: string } {
  const digits = raw.replace(/\D/g, '');
  if (digits.length >= 10) {
    return { ddd: digits.slice(0, 2), fone: digits.slice(2) };
  }
  return { ddd: '47', fone: digits || '000000000' };
}

@Injectable()
export class FiscalIpmService {
  private readonly logger = new Logger(FiscalIpmService.name);

  constructor(
    private readonly ipm: IpmNfseAdapter,
    private readonly config: ConfigService,
  ) {}

  usesRealIpm(): boolean {
    return this.ipm.isConfigured();
  }

  private resolveTom(ibge: string | null | undefined): string {
    const key = (ibge ?? '').replace(/\D/g, '');
    return IBGE_TOM[key] ?? this.config.get<string>('nfse.ipm.tomadorTomFallback', { infer: true }) ?? '8221';
  }

  buildTomador(cliente: Cliente): TomadorNfseDto {
    const tel = splitPhone(cliente.telefone ?? cliente.responsavelTelefone ?? '4733334444');
    const tipo = cliente.tipo === 'PF' ? 'F' : 'J';
    return {
      tipo,
      cpfcnpj: cliente.cpfCnpj.replace(/\D/g, ''),
      ie: cliente.inscricaoEstadual ?? '',
      nomeRazaoSocial: cliente.razaoSocial,
      sobrenomeNomeFantasia: cliente.nomeFantasia ?? cliente.razaoSocial,
      numeroResidencia: cliente.enderecoNumero,
      complemento: cliente.enderecoComplemento ?? '',
      pontoReferencia: '0',
      pais: 'Brasil',
      siglaPais: 'BR',
      codigoIbgePais: '1058',
      estado: cliente.enderecoUf,
      cidadeTom: this.resolveTom(cliente.codigoMunicipioIbge),
      logradouro: cliente.enderecoLogradouro,
      bairro: cliente.enderecoBairro,
      cep: cliente.enderecoCep.replace(/\D/g, ''),
      dddFoneComercial: tel.ddd,
      foneComercial: tel.fone,
      email: (cliente.emailNfse ?? cliente.email).trim().toLowerCase(),
    };
  }

  buildPayload(
    fatura: Fatura,
    cliente: Cliente,
    ctx: { containerIso: string; diasCobrados: number; gateOutAt: Date; outboxId: string },
  ): EmissaoNfseIpmPayload {
    const arm = this.config.get<{ codigoLocalPrestacao: string; codigoAtividade: string; codigoItemListaServico: string; aliquotaPercent: number; situacaoTributaria: string }>(
      'nfse.ipm.armazenagem',
      { infer: true },
    )!;
    const valor = Number(fatura.valorTotal);
    const emissao = ctx.gateOutAt;
    const rpsNumero = String(Date.now()).slice(-9);
    const descritivo = `Armazenagem contêiner ${ctx.containerIso} — ${ctx.diasCobrados} diária(s) após free time. Ref ${fatura.id.slice(0, 8)}.`;

    return {
      identificadorArquivo: ctx.outboxId || randomUUID(),
      rps: {
        nroReciboProvisorio: rpsNumero,
        serieReciboProvisorio: 'RPS',
        dataEmissao: formatBrDate(emissao),
        horaEmissao: formatBrTime(emissao),
      },
      dataFato: formatBrDate(emissao),
      valorTotal: valor,
      observacao: descritivo.slice(0, 500),
      prestador: {
        cnpj: this.ipm.getPrestadorCnpj().replace(/\D/g, ''),
        cidadeTom: this.ipm.getPrestadorTom(),
      },
      tomador: this.buildTomador(cliente),
      servico: {
        codigoLocalPrestacao: arm.codigoLocalPrestacao,
        codigoAtividade: arm.codigoAtividade,
        codigoItemListaServico: arm.codigoItemListaServico,
        descritivo,
        aliquotaPercent: arm.aliquotaPercent,
        situacaoTributaria: arm.situacaoTributaria,
        valorTributavel: valor,
        tributaMunicipioPrestador: 'S',
        tributaMunicipioTomador: 'N',
      },
    };
  }

  /** Emite NFS-e via IPM real ou sandbox quando credenciais ausentes. */
  async emitirParaFatura(
    fatura: Fatura,
    cliente: Cliente,
    ctx: { containerIso: string; diasCobrados: number; gateOutAt: Date; outboxId: string },
  ): Promise<FiscalEmissaoResult> {
    const payload = this.buildPayload(fatura, cliente, ctx);
    const rpsNumero = payload.rps.nroReciboProvisorio;
    const rpsSerie = payload.rps.serieReciboProvisorio;

    if (!this.ipm.isConfigured()) {
      this.logger.warn('IPM não configurado — sandbox fiscal local');
      const link = `${this.config.get('banking.sandboxPublicBaseUrl') ?? '/portal/financeiro'}?nfse=sandbox-${fatura.id}`;
      return {
        mode: 'emitida',
        numeroNfse: `SANDBOX-${rpsNumero}`,
        linkNfse: link,
        codVerificador: `SBX-${fatura.id.slice(0, 8)}`,
        xmlResposta: '<nfse>sandbox</nfse>',
        rpsNumero,
        rpsSerie,
      };
    }

    try {
      const r = await this.ipm.emitir(payload);
      if (r.retorno.sucesso && r.retorno.emissao) {
        return {
          mode: 'emitida',
          numeroNfse: r.retorno.emissao.numeroNfse,
          linkNfse: r.retorno.emissao.linkNfse ?? '',
          codVerificador: r.retorno.emissao.codVerificadorAutenticidade,
          xmlResposta: r.xmlResposta,
          rpsNumero,
          rpsSerie,
        };
      }

      const pendente =
        r.retorno.erros.some((e) => /pendente|processamento|lote/i.test(e)) ||
        (!r.retorno.emissao?.numeroNfse && r.retorno.erros.length === 0);

      if (pendente) {
        return {
          mode: 'pendente',
          rpsNumero,
          rpsSerie,
          codVerificador: r.retorno.emissao?.codVerificadorAutenticidade,
          xmlResposta: r.xmlResposta,
        };
      }

      throw new Error(r.retorno.erros.join(' | ') || 'Emissão NFS-e rejeitada');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/rede|timeout|ECONN|503|502|504|fetch failed/i.test(msg)) {
        throw new RetriableOutboxError(`IPM indisponível: ${msg}`);
      }
      throw e;
    }
  }

  async consultarPendente(codVerificador: string) {
    if (!this.ipm.isConfigured()) return null;
    try {
      const r = await this.ipm.consultarPorCodigoAutenticidade(codVerificador);
      if (r.retorno.sucesso && r.retorno.emissao?.numeroNfse) {
        return {
          numeroNfse: r.retorno.emissao.numeroNfse,
          linkNfse: r.retorno.emissao.linkNfse ?? '',
          xmlResposta: r.xmlResposta,
        };
      }
      return null;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/rede|timeout|ECONN|503|502|504|fetch failed/i.test(msg)) {
        throw new RetriableOutboxError(`Consulta IPM indisponível: ${msg}`);
      }
      throw e;
    }
  }

  /** Probe de conectividade IPM para health check Terminus (M1). */
  async probeConnectivity(): Promise<{
    ok: boolean;
    latencyMs: number;
    mode: 'live' | 'sandbox' | 'offline';
    reason?: string;
  }> {
    return this.ipm.probeHealth();
  }
}
