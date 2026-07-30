import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FiscalIpmService } from '../fiscal-integracao/fiscal-ipm.service';
import { BankingBoletoService } from '../fiscal-integracao/banking-boleto.service';
import { ObjectStorageService } from '../common/storage/object-storage.service';
import { OCRService } from '../modules/ocr/ocr.service';
import { WhatsappService } from '../notification/whatsapp.service';
import type { TenantParametrosIntegracoes, WhatsAppTemplateStatus } from './tenant-config.types';

export type IntegrationTestResult = {
  connected: boolean;
  message: string;
  latencyMs?: number;
};

@Injectable()
export class TenantConfigProbesService {
  constructor(
    private readonly config: ConfigService,
    private readonly fiscalIpm: FiscalIpmService,
    private readonly banking: BankingBoletoService,
    private readonly storage: ObjectStorageService,
    private readonly ocr: OCRService,
    private readonly whatsapp: WhatsappService,
  ) {}

  buildIntegracoesStatus(): TenantParametrosIntegracoes {
    const waEnabled = this.whatsapp.isEnabled();
    const phoneNumberId = this.config.get<string>('whatsapp.phoneNumberId')?.trim();
    const bankingProvider = this.config.get<string>('banking.provider') ?? 'sandbox';
    const bucket = process.env.AWS_S3_BUCKET?.trim();
    const endpoint =
      process.env.STORAGE_ENDPOINT ?? process.env.S3_ENDPOINT ?? process.env.R2_ENDPOINT;

    return {
      whatsapp: {
        enabled: waEnabled && Boolean(this.config.get<string>('whatsapp.accessToken')?.trim()),
        phoneNumberId: phoneNumberId || undefined,
        templatesAprovados: 0,
      },
      googleVision: {
        enabled: this.ocr.isGoogleVisionAvailable(),
        apiKeyPresent: this.ocr.isGoogleVisionAvailable(),
      },
      banking: {
        enabled: this.banking.isConfigured(),
        provider: bankingProvider,
      },
      s3: {
        enabled: this.storage.usesS3(),
        bucket: bucket || undefined,
        endpoint: endpoint || undefined,
      },
    };
  }

  async testIpmConnection(): Promise<IntegrationTestResult> {
    const start = Date.now();
    try {
      const result = await this.fiscalIpm.probeConnectivity();
      return {
        connected: result.ok,
        message: result.ok
          ? `IPM conectado — modo ${result.mode}`
          : result.reason ?? 'IPM indisponível',
        latencyMs: result.latencyMs ?? Date.now() - start,
      };
    } catch (err) {
      return {
        connected: false,
        message: `Erro ao conectar IPM: ${(err as Error).message}`,
        latencyMs: Date.now() - start,
      };
    }
  }

  async testWhatsappConnection(): Promise<IntegrationTestResult> {
    const start = Date.now();
    if (!this.whatsapp.isEnabled()) {
      return { connected: false, message: 'WhatsApp desabilitado (WHATSAPP_ENABLED=false)' };
    }
    const probe = await this.whatsapp.probeHealth();
    return {
      connected: probe.ok,
      message: probe.message,
      latencyMs: Date.now() - start,
    };
  }

  async testGoogleVisionConnection(): Promise<IntegrationTestResult> {
    const start = Date.now();
    const result = await this.ocr.testConnection();
    return {
      connected: result.ok,
      message: result.message,
      latencyMs: Date.now() - start,
    };
  }

  async testBankingConnection(): Promise<IntegrationTestResult> {
    const start = Date.now();
    const result = await this.banking.testConnection();
    return {
      connected: result.ok,
      message: result.message,
      latencyMs: result.latencyMs ?? Date.now() - start,
    };
  }

  async testS3Connection(): Promise<IntegrationTestResult> {
    const start = Date.now();
    const result = await this.storage.testConnection();
    return {
      connected: result.ok,
      message: result.message,
      latencyMs: Date.now() - start,
    };
  }

  async revalidateWhatsappTemplates(): Promise<{ name: string; status: WhatsAppTemplateStatus }[]> {
    const names = [
      ...WhatsappService.DUNNING_TEMPLATES,
      this.config.get<string>('whatsapp.templateOperacional') ?? 'rl_operacional_armazenamento',
      this.config.get<string>('whatsapp.templateFinanceiro') ?? 'rl_financeiro_fatura_consolidada',
    ].filter((v, i, a) => a.indexOf(v) === i);

    const out: { name: string; status: WhatsAppTemplateStatus }[] = [];
    for (const name of names) {
      const r = await this.whatsapp.checkTemplateStatus(name);
      let status: WhatsAppTemplateStatus = 'PENDING';
      if (r.status === 'APPROVED' || r.approved) status = 'APPROVED';
      else if (r.status === 'REJECTED') status = 'REJECTED';
      else if (r.status === 'DISABLED') status = 'DISABLED';
      else if (r.status === 'sandbox') status = 'APPROVED';
      else if (r.status === 'NOT_FOUND') status = 'PENDING';
      out.push({ name, status });
    }
    return out;
  }

  async testSlackWebhook(url: string): Promise<IntegrationTestResult> {
    const start = Date.now();
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'RL Transportes — teste de webhook (Parâmetros › Notificações)',
        }),
        signal: AbortSignal.timeout(15_000),
      });
      return {
        connected: res.ok,
        message: res.ok ? 'Webhook respondeu com sucesso' : `HTTP ${res.status}`,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      return {
        connected: false,
        message: (err as Error).message,
        latencyMs: Date.now() - start,
      };
    }
  }
}
