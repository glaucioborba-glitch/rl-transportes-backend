import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FiscalIpmService } from '../fiscal-integracao/fiscal-ipm.service';
import { BankingBoletoService } from '../fiscal-integracao/banking-boleto.service';
import { NfseNacionalService } from '../nfse-nacional/nfse-nacional.service';
import { ObjectStorageService } from '../common/storage/object-storage.service';
import { OCRService } from '../modules/ocr/ocr.service';
import { WhatsappService } from '../notification/whatsapp.service';
import { IntegrationCredentialsService } from './integration-credentials.service';
import { maskPixKey } from './integration-credentials.util';
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
    private readonly nfseNacional: NfseNacionalService,
    private readonly banking: BankingBoletoService,
    private readonly storage: ObjectStorageService,
    private readonly ocr: OCRService,
    private readonly whatsapp: WhatsappService,
    private readonly integrationCreds: IntegrationCredentialsService,
  ) {}

  buildIntegracoesStatus(tenantId?: string): TenantParametrosIntegracoes {
    const tid = tenantId ?? this.integrationCreds.currentTenantId();
    const google = this.integrationCreds.peekGoogleVision(tid);
    const maps = this.integrationCreds.peekGoogleMaps(tid);
    const routes = this.integrationCreds.peekGoogleRoutes(tid);
    const wa = this.integrationCreds.peekWhatsapp(tid);
    const boleto = this.integrationCreds.peekBanking(tid);
    const pix = this.integrationCreds.peekPix(tid);
    const s3 = this.integrationCreds.peekS3(tid);
    const ipm = this.integrationCreds.peekIpm(tid);
    const nacional = this.integrationCreds.peekNfseNacional(tid);
    const certificado = this.nfseNacional.inspecionarCertificado(nacional);

    const boletoStatus = {
      enabled: boleto.configured,
      configured: boleto.configured,
      origem: boleto.origem,
      lockedByEnv: boleto.lockedByEnv,
      apiBaseUrl: boleto.apiBaseUrl,
    };

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
      googleMaps: {
        enabled: maps.configured,
        configured: maps.configured,
        origem: maps.origem,
        lockedByEnv: maps.lockedByEnv,
        apiKeyPresent: maps.configured,
      },
      googleRoutes: {
        enabled: routes.configured,
        configured: routes.configured,
        origem: routes.origem,
        lockedByEnv: routes.lockedByEnv,
        apiKeyPresent: routes.configured,
      },
      banking: boletoStatus,
      boleto: boletoStatus,
      pix: {
        enabled: pix.configured,
        configured: pix.configured || pix.chavePixPresent,
        origem: pix.origem,
        lockedByEnv: pix.lockedByEnv,
        apiBaseUrl: pix.apiBaseUrl,
        chavePixPresent: pix.chavePixPresent,
        chavePixHint: maskPixKey(pix.chavePix),
        apiTokenPresent: Boolean(pix.apiToken),
      },
      ipm: {
        enabled: ipm.configured,
        configured: ipm.configured,
        origem: ipm.origem,
        lockedByEnv: ipm.lockedByEnv,
        baseUrl: ipm.baseUrl,
        prestadorCnpj: ipm.prestadorCnpj,
        prestadorTom: ipm.prestadorTom,
        municipioIbge: ipm.municipioIbge,
        senhaPresente: ipm.senhaPresente,
        certificadoPresente: ipm.certificadoPresente,
        certificadoOrigem: ipm.certificadoPfxBase64
          ? 'tenant'
          : ipm.certificadoCaminho
            ? 'servidor'
            : 'nenhum',
        codigoLocalPrestacao: ipm.armazenagem.codigoLocalPrestacao,
        codigoAtividade: ipm.armazenagem.codigoAtividade,
        codigoItemListaServico: ipm.armazenagem.codigoItemListaServico,
        aliquotaPercent: ipm.armazenagem.aliquotaPercent,
        situacaoTributaria: ipm.armazenagem.situacaoTributaria,
        tomadorTomFallback: ipm.tomadorTomFallback,
      },
      nfseNacional: {
        enabled: nacional.configured && nacional.ativacao !== 'DESLIGADO',
        configured: nacional.configured,
        origem: nacional.origem,
        lockedByEnv: nacional.lockedByEnv,
        ativacao: nacional.ativacao,
        ambiente: nacional.ambiente,
        certificadoPresente: nacional.certificadoPresente,
        certificadoTitular: certificado.titular,
        certificadoValidoAte: certificado.validoAte?.toISOString(),
        certificadoDiasParaVencer: certificado.diasParaVencer,
        certificadoErro: certificado.erro,
        cnpjPrestador: nacional.cnpjPrestador,
        inscricaoMunicipal: nacional.inscricaoMunicipal,
        municipioIbge: nacional.municipioIbge,
        serieDps: nacional.serieDps,
        codigoTributacaoNacional: nacional.codigoTributacaoNacional,
        aliquotaIssPercent: nacional.aliquotaIssPercent,
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

  /** Testa certificado + handshake mTLS com o Sefin Nacional. */
  async testNfseNacionalConnection(tenantId?: string): Promise<IntegrationTestResult> {
    try {
      return await this.nfseNacional.testarConexao(tenantId);
    } catch (e) {
      return { connected: false, message: e instanceof Error ? e.message : String(e) };
    }
  }

  async testIpmConnection(tenantId?: string): Promise<IntegrationTestResult> {
    const start = Date.now();
    try {
      const result = await this.fiscalIpm.probeConnectivity(tenantId);
      const cfg = this.integrationCreds.peekIpm(tenantId);
      const certificado = cfg.certificadoPresente
        ? cfg.certificadoPfxBase64
          ? ' Certificado do terminal em uso.'
          : ' Certificado do servidor em uso.'
        : ' Sem certificado A1.';
      return {
        connected: result.ok,
        message: result.ok
          ? `IPM conectado — modo ${result.mode}.${certificado}`
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

  async testGoogleMapsConnection(): Promise<IntegrationTestResult> {
    const start = Date.now();
    const maps = await this.integrationCreds.resolveGoogleMaps();
    if (!maps.apiKey) {
      return { connected: false, message: 'Google Maps API key não configurada' };
    }
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=Brasil&key=${encodeURIComponent(maps.apiKey)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      const json = (await res.json()) as { status?: string; error_message?: string };
      const ok = json.status === 'OK' || json.status === 'ZERO_RESULTS';
      return {
        connected: ok,
        message: ok
          ? 'Google Maps JavaScript / Geocoding acessível'
          : json.error_message || json.status || `HTTP ${res.status}`,
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

  async testGoogleRoutesConnection(): Promise<IntegrationTestResult> {
    const start = Date.now();
    const routes = await this.integrationCreds.resolveGoogleRoutes();
    if (!routes.apiKey) {
      return { connected: false, message: 'Google Routes API key não configurada' };
    }
    try {
      const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': routes.apiKey,
          'X-Goog-FieldMask': 'routes.duration',
        },
        body: JSON.stringify({
          origin: { location: { latLng: { latitude: -26.907, longitude: -48.661 } } },
          destination: { location: { latLng: { latitude: -26.91, longitude: -48.66 } } },
          travelMode: 'DRIVE',
        }),
        signal: AbortSignal.timeout(10_000),
      });
      const json = (await res.json()) as { error?: { message?: string } };
      const ok = res.ok;
      return {
        connected: ok,
        message: ok ? 'Google Routes acessível' : json.error?.message || `HTTP ${res.status}`,
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

  async testPixConnection(): Promise<IntegrationTestResult> {
    const pix = await this.integrationCreds.resolvePix();
    if (pix.configured) {
      const r = await this.banking.testPixConnection();
      return { connected: r.ok, message: r.message, latencyMs: r.latencyMs };
    }
    if (pix.chavePixPresent) {
      return {
        connected: true,
        message: `Chave PIX salva (${maskPixKey(pix.chavePix)}). Cobrança em sandbox até informar a API PIX.`,
      };
    }
    return { connected: false, message: 'Informe a API PIX (URL + token) e a chave de recebimento.' };
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
