import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FiscalIpmService } from '../fiscal-integracao/fiscal-ipm.service';
import { BankingBoletoService } from '../fiscal-integracao/banking-boleto.service';
import { ObjectStorageService } from '../common/storage/object-storage.service';
import { OCRService } from '../modules/ocr/ocr.service';
import { WhatsappService } from '../notification/whatsapp.service';
import { IntegrationCredentialsService } from './integration-credentials.service';
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
    private readonly integrationCreds: IntegrationCredentialsService,
  ) {}

  buildIntegracoesStatus(): TenantParametrosIntegracoes {
    const google = this.integrationCreds.peekGoogleVision();
    const wa = this.integrationCreds.peekWhatsapp();
    const banking = this.integrationCreds.peekBanking();
    const s3 = this.integrationCreds.peekS3();

    return {
      whatsapp: {
        enabled: wa.configured,
        configured: wa.configured,
        origem: wa.origem,
        lockedByEnv: wa.lockedByEnv,
        phoneNumberId: wa.phoneNumberId,
        templatesAprovados: 0,
        accessTokenPresent: wa.accessTokenPresent,
        businessAccountIdPresent: wa.businessAccountIdPresent,
      },
      googleVision: {
        enabled: google.configured,
        configured: google.configured,
        origem: google.origem,
        lockedByEnv: google.lockedByEnv,
        apiKeyPresent: google.configured,
        clientEmail: google.clientEmail ?? (google.apiKey ? 'API key' : undefined),
      },
      banking: {
        enabled: banking.configured,
        configured: banking.configured,
        origem: banking.origem,
        lockedByEnv: banking.lockedByEnv,
        provider: banking.provider,
        apiBaseUrl: banking.apiBaseUrl,
      },
      s3: {
        enabled: s3.configured || this.storage.usesS3(),
        configured: s3.configured || this.storage.usesS3(),
        origem: s3.origem !== 'none' ? s3.origem : this.storage.usesS3() ? 'env' : 'none',
        lockedByEnv: s3.lockedByEnv || this.storage.usesS3(),
        bucket: s3.bucket,
        endpoint: s3.endpoint,
        region: s3.region,
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
