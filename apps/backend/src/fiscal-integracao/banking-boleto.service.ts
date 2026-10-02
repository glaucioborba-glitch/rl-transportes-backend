import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Cliente, Fatura } from '@prisma/client';
import QRCode from 'qrcode';
import { IntegrationCredentialsService } from '../tenant/integration-credentials.service';
import { RetriableOutboxError } from '../outbox/outbox.errors';
import type { BoletoRegistroResult, PixCobrancaResult } from './fiscal-integracao.types';

type PagadorPix = {
  razaoSocial: string;
  cpfCnpj: string;
  email?: string | null;
  emailNfse?: string | null;
};

@Injectable()
export class BankingBoletoService {
  private readonly logger = new Logger(BankingBoletoService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly integrationCreds: IntegrationCredentialsService,
  ) {}

  isConfigured(): boolean {
    return this.integrationCreds.peekBanking().configured;
  }

  async testConnection(): Promise<{ ok: boolean; message: string; latencyMs?: number }> {
    const banking = await this.integrationCreds.resolveBanking();
    if (!banking.configured) {
      return { ok: false, message: 'API de boleto não configurada (modo sandbox)' };
    }
    return this.probeHealth(banking.apiBaseUrl!, 'API de boleto');
  }

  async testPixConnection(): Promise<{ ok: boolean; message: string; latencyMs?: number }> {
    const pix = await this.integrationCreds.resolvePix();
    if (!pix.configured) {
      return { ok: false, message: 'API PIX não configurada (modo sandbox)' };
    }
    return this.probeHealth(pix.apiBaseUrl!, 'API PIX');
  }

  private async probeHealth(baseUrl: string, label: string) {
    const start = Date.now();
    try {
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/health`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });
      return {
        ok: res.ok,
        message: res.ok ? `${label} acessível` : `${label} HTTP ${res.status}`,
        latencyMs: Date.now() - start,
      };
    } catch (e) {
      return {
        ok: false,
        message: (e as Error).message,
        latencyMs: Date.now() - start,
      };
    }
  }

  private sandboxResult(
    fatura: Fatura,
    vencimento: Date,
    parcela?: { indice: number; total: number },
  ): BoletoRegistroResult {
    const base = this.config.get<string>('banking.sandboxPublicBaseUrl', { infer: true }) ?? '/portal/financeiro';
    const ref = fatura.id.slice(0, 8).toUpperCase();
    const parcelaTag = parcela ? `${parcela.indice}de${parcela.total}` : Date.now().toString().slice(-6);
    return {
      numeroBoleto: `SBX-${ref}-${parcelaTag}-${Date.now().toString().slice(-6)}`,
      linkPdf: `${base}?boleto=${fatura.id}`,
      pixCopiaCola: `00020126580014br.gov.bcb.pix0136${fatura.id.replace(/-/g, '')}5204000053039865802BR5913RL Transportes6009Navegantes62070503***6304ABCD`,
      pixQrCodeUrl: `${base}?pix=${fatura.id}`,
      dataVencimento: vencimento,
      provedor: 'sandbox',
      referenciaExterna: parcela ? `${fatura.id}-${parcela.indice}` : fatura.id,
    };
  }

  async registrarBoleto(
    fatura: Fatura,
    cliente: Cliente,
    ctx: {
      gateOutAt: Date;
      containerIso: string;
      diasVencimento?: number;
      vencimento?: Date;
      valor?: number;
      parcela?: { indice: number; total: number };
    },
  ): Promise<BoletoRegistroResult> {
    const dias = Number(ctx.diasVencimento ?? this.config.get<number>('banking.vencimentoDias', { infer: true }) ?? 7) || 7;
    const vencimento = ctx.vencimento
      ? new Date(ctx.vencimento)
      : (() => {
          const d = new Date(ctx.gateOutAt);
          d.setUTCDate(d.getUTCDate() + dias);
          return d;
        })();
    const valor = ctx.valor ?? Number(fatura.valorTotal);

    const banking = await this.integrationCreds.resolveBanking();
    if (!banking.configured) {
      this.logger.warn('Banking API não configurada — sandbox boleto/PIX');
      return this.sandboxResult(fatura, vencimento, ctx.parcela);
    }

    const baseUrl = banking.apiBaseUrl!;
    const token = banking.apiToken!;
    const provider = banking.provider || 'api';

    const body = {
      referencia: fatura.id,
      valor,
      vencimento: vencimento.toISOString().slice(0, 10),
      pagador: {
        nome: cliente.razaoSocial,
        documento: cliente.cpfCnpj.replace(/\D/g, ''),
        email: cliente.emailNfse ?? cliente.email,
      },
      descricao: ctx.parcela
        ? `Armazenagem ${ctx.containerIso} (${ctx.parcela.indice}/${ctx.parcela.total})`
        : `Armazenagem ${ctx.containerIso}`,
      pix: true,
    };

    try {
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/boletos`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (res.status >= 500) {
        throw new RetriableOutboxError(`Bank API HTTP ${res.status}`);
      }
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Bank API ${res.status}: ${txt.slice(0, 300)}`);
      }

      const data = (await res.json()) as {
        numero?: string;
        numeroBoleto?: string;
        linkPdf?: string;
        link?: string;
        pixCopiaCola?: string;
        pixQrCode?: string;
        id?: string;
      };

      return {
        numeroBoleto: data.numeroBoleto ?? data.numero ?? `BNK-${Date.now()}`,
        linkPdf: data.linkPdf ?? data.link ?? '',
        pixCopiaCola: data.pixCopiaCola ?? '',
        pixQrCodeUrl: data.pixQrCode ?? '',
        dataVencimento: vencimento,
        provedor: provider,
        referenciaExterna: data.id ?? fatura.id,
      };
    } catch (e) {
      if (e instanceof RetriableOutboxError) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      if (/rede|timeout|ECONN|fetch failed/i.test(msg)) {
        throw new RetriableOutboxError(`Bank API indisponível: ${msg}`);
      }
      throw e;
    }
  }

  /** PIX para crédito na conta corrente (API do banco do tenant; sandbox se não configurada). */
  async gerarPixCobranca(opts: {
    referencia: string;
    valor: number;
    descricao: string;
    cliente: PagadorPix;
  }): Promise<PixCobrancaResult> {
    const pix = await this.integrationCreds.resolvePix();
    if (!pix.configured) {
      this.logger.warn('API PIX não configurada — sandbox PIX conta corrente');
      return this.withQrImage({
        pixCopiaCola: this.sandboxPixPayload(opts.referencia),
        pixQrCodeUrl: '',
        provedor: 'sandbox',
        referenciaExterna: opts.referencia,
        sandbox: true,
      });
    }

    const baseUrl = pix.apiBaseUrl!.replace(/\/$/, '');
    const token = pix.apiToken!;
    const vencimento = new Date();
    vencimento.setUTCDate(vencimento.getUTCDate() + 1);
    const body = {
      referencia: opts.referencia,
      valor: opts.valor,
      vencimento: vencimento.toISOString().slice(0, 10),
      pagador: {
        nome: opts.cliente.razaoSocial,
        documento: opts.cliente.cpfCnpj.replace(/\D/g, ''),
        email: opts.cliente.emailNfse ?? opts.cliente.email,
      },
      descricao: opts.descricao,
      pix: true,
      tipo: 'CREDITO_CONTA_CORRENTE',
      chavePix: pix.chavePix || undefined,
    };

    const parsed = await this.postBankPix(baseUrl, token, body);
    return this.withQrImage({
      pixCopiaCola: parsed.pixCopiaCola,
      pixQrCodeUrl: parsed.pixQrCodeUrl,
      provedor: 'pix',
      referenciaExterna: parsed.referenciaExterna || opts.referencia,
      sandbox: false,
    });
  }

  private sandboxPixPayload(referencia: string): string {
    const txid = referencia.replace(/[^a-zA-Z0-9]/g, '').slice(0, 32).padEnd(32, '0');
    return `00020126580014br.gov.bcb.pix0136${txid}5204000053039865802BR5913RL Transportes6009Navegantes62070503***6304ABCD`;
  }

  private qrImageUrl(url: string): boolean {
    return url.startsWith('data:image') || /^https?:\/\//i.test(url);
  }

  private async withQrImage(result: PixCobrancaResult): Promise<PixCobrancaResult> {
    if (result.pixQrCodeUrl && this.qrImageUrl(result.pixQrCodeUrl)) return result;
    if (!result.pixCopiaCola) return result;
    const pixQrCodeUrl = await QRCode.toDataURL(result.pixCopiaCola, {
      margin: 1,
      width: 280,
      errorCorrectionLevel: 'M',
    });
    return { ...result, pixQrCodeUrl };
  }

  private async postBankPix(
    baseUrl: string,
    token: string,
    body: Record<string, unknown>,
  ): Promise<{ pixCopiaCola: string; pixQrCodeUrl: string; referenciaExterna: string }> {
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    const parse = async (res: Response) => {
      if (res.status >= 500) {
        throw new RetriableOutboxError(`Bank API HTTP ${res.status}`);
      }
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Bank API ${res.status}: ${txt.slice(0, 300)}`);
      }
      const data = (await res.json()) as {
        pixCopiaCola?: string;
        pixQrCode?: string;
        pixQrCodeUrl?: string;
        id?: string;
      };
      return {
        pixCopiaCola: data.pixCopiaCola ?? '',
        pixQrCodeUrl: data.pixQrCodeUrl ?? data.pixQrCode ?? '',
        referenciaExterna: data.id ?? '',
      };
    };

    try {
      const pixRes = await fetch(`${baseUrl}/pix`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      if (pixRes.status !== 404) {
        return parse(pixRes);
      }
      const boletoRes = await fetch(`${baseUrl}/boletos`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      return parse(boletoRes);
    } catch (e) {
      if (e instanceof RetriableOutboxError) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      if (/rede|timeout|ECONN|fetch failed/i.test(msg)) {
        throw new RetriableOutboxError(`Bank API indisponível: ${msg}`);
      }
      throw e;
    }
  }
}
