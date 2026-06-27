import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Cliente, Fatura } from '@prisma/client';
import { RetriableOutboxError } from '../outbox/outbox.errors';
import type { BoletoRegistroResult } from './fiscal-integracao.types';

@Injectable()
export class BankingBoletoService {
  private readonly logger = new Logger(BankingBoletoService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    const provider = this.config.get<string>('banking.provider', { infer: true }) ?? 'sandbox';
    if (provider === 'sandbox') return false;
    const base = this.config.get<string>('banking.apiBaseUrl', { infer: true }) ?? '';
    const token = this.config.get<string>('banking.apiToken', { infer: true }) ?? '';
    return base.length > 0 && token.length > 0;
  }

  private sandboxResult(fatura: Fatura, vencimento: Date): BoletoRegistroResult {
    const base = this.config.get<string>('banking.sandboxPublicBaseUrl', { infer: true }) ?? '/portal/financeiro';
    const ref = fatura.id.slice(0, 8).toUpperCase();
    return {
      numeroBoleto: `SBX-${ref}-${Date.now().toString().slice(-6)}`,
      linkPdf: `${base}?boleto=${fatura.id}`,
      pixCopiaCola: `00020126580014br.gov.bcb.pix0136${fatura.id.replace(/-/g, '')}5204000053039865802BR5913RL Transportes6009Navegantes62070503***6304ABCD`,
      pixQrCodeUrl: `${base}?pix=${fatura.id}`,
      dataVencimento: vencimento,
      provedor: 'sandbox',
      referenciaExterna: fatura.id,
    };
  }

  async registrarBoleto(
    fatura: Fatura,
    cliente: Cliente,
    ctx: { gateOutAt: Date; containerIso: string },
  ): Promise<BoletoRegistroResult> {
    const dias = Number(this.config.get<number>('banking.vencimentoDias', { infer: true }) ?? 7) || 7;
    const vencimento = new Date(ctx.gateOutAt);
    vencimento.setDate(vencimento.getDate() + dias);

    if (!this.isConfigured()) {
      this.logger.warn('Banking API não configurada — sandbox boleto/PIX');
      return this.sandboxResult(fatura, vencimento);
    }

    const baseUrl = this.config.get<string>('banking.apiBaseUrl', { infer: true })!;
    const token = this.config.get<string>('banking.apiToken', { infer: true })!;
    const provider = this.config.get<string>('banking.provider', { infer: true }) ?? 'api';

    const body = {
      referencia: fatura.id,
      valor: Number(fatura.valorTotal),
      vencimento: vencimento.toISOString().slice(0, 10),
      pagador: {
        nome: cliente.razaoSocial,
        documento: cliente.cpfCnpj.replace(/\D/g, ''),
        email: cliente.emailNfse ?? cliente.email,
      },
      descricao: `Armazenagem ${ctx.containerIso}`,
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
}
