import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RetriableOutboxError } from '../outbox/outbox.errors';
import { maskPhoneE164 } from './whatsapp-phone.util';
import type { WhatsappSendResult, WhatsappTemplateSendParams } from './whatsapp.types';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(private readonly config: ConfigService) {}

  /** Templates de dunning exigidos quando WhatsApp está habilitado. */
  static readonly DUNNING_TEMPLATES = [
    'dunning_pre_vencimento',
    'dunning_vencimento',
    'dunning_atraso_leve',
    'dunning_pre_bloqueio',
  ] as const;

  isEnabled(): boolean {
    return this.config.get<boolean>('whatsapp.enabled') === true;
  }

  /**
   * Envia Message Template (Meta Cloud API).
   * Quando desabilitado, registra em log (sandbox) sem falhar o fluxo.
   */
  async sendTemplate(params: WhatsappTemplateSendParams): Promise<WhatsappSendResult> {
    const enabled = this.isEnabled();
    const token = this.config.get<string>('whatsapp.accessToken')?.trim() ?? '';
    const phoneNumberId = this.config.get<string>('whatsapp.phoneNumberId')?.trim() ?? '';
    const provider = this.config.get<string>('whatsapp.provider') ?? 'meta';

    const preview = `[${params.templateName}] → ${maskPhoneE164(params.toE164)} | ${params.bodyParameters.join(' | ')}`;

    if (!enabled || !token || !phoneNumberId) {
      this.logger.warn(`WhatsApp sandbox (não enviado): ${preview}`);
      return {
        messageId: `sandbox-${Date.now()}`,
        mode: 'sandbox',
        provider,
      };
    }

    const base = this.config.get<string>('whatsapp.apiBaseUrl') ?? 'https://graph.facebook.com/v19.0';
    const url = `${base}/${phoneNumberId}/messages`;

    const body = {
      messaging_product: 'whatsapp',
      to: params.toE164.replace(/^\+/, ''),
      type: 'template',
      template: {
        name: params.templateName,
        language: { code: params.languageCode ?? 'pt_BR' },
        components: [
          {
            type: 'body',
            parameters: params.bodyParameters.map((text) => ({ type: 'text', text })),
          },
        ],
      },
    };

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new RetriableOutboxError(`WhatsApp API indisponível: ${msg}`);
    }

    const text = await res.text();
    if (!res.ok) {
      const retriable = res.status >= 500 || res.status === 429;
      const errMsg = `WhatsApp HTTP ${res.status}: ${text.slice(0, 500)}`;
      if (retriable) throw new RetriableOutboxError(errMsg);
      throw new Error(errMsg);
    }

    let messageId = `wa-${Date.now()}`;
    try {
      const parsed = JSON.parse(text) as { messages?: { id?: string }[] };
      messageId = parsed.messages?.[0]?.id ?? messageId;
    } catch {
      /* mantém fallback */
    }

    this.logger.log(`WhatsApp enviado (${messageId}) → ${maskPhoneE164(params.toE164)}`);
    return { messageId, mode: 'live', provider };
  }

  /** Verifica conectividade / credenciais Meta. */
  async probeHealth(): Promise<{ ok: boolean; message: string }> {
    if (!this.isEnabled()) {
      return { ok: false, message: 'WhatsApp desabilitado' };
    }
    const token = this.config.get<string>('whatsapp.accessToken')?.trim() ?? '';
    const phoneNumberId = this.config.get<string>('whatsapp.phoneNumberId')?.trim() ?? '';
    if (!token || !phoneNumberId) {
      return { ok: false, message: 'WHATSAPP_ACCESS_TOKEN ou WHATSAPP_PHONE_NUMBER_ID ausente' };
    }
    const tpl = await this.checkTemplateStatus(WhatsappService.DUNNING_TEMPLATES[0]);
    return {
      ok: tpl.approved || tpl.status === 'APPROVED' || tpl.status === 'sandbox',
      message: tpl.reason ?? `Template ${WhatsappService.DUNNING_TEMPLATES[0]}: ${tpl.status ?? 'ok'}`,
    };
  }

  /** Verifica se template está aprovado na Meta (ou sandbox quando desabilitado). */
  async checkTemplateStatus(
    templateName: string,
  ): Promise<{ approved: boolean; status?: string; reason?: string }> {
    if (!this.isEnabled()) {
      return { approved: true, status: 'sandbox', reason: 'WhatsApp desabilitado' };
    }

    const token = this.config.get<string>('whatsapp.accessToken')?.trim() ?? '';
    const wabaId = this.config.get<string>('whatsapp.businessAccountId')?.trim() ?? '';
    if (!token || !wabaId) {
      return { approved: false, reason: 'WHATSAPP_ACCESS_TOKEN ou WHATSAPP_BUSINESS_ACCOUNT_ID ausente' };
    }

    const base = this.config.get<string>('whatsapp.apiBaseUrl') ?? 'https://graph.facebook.com/v19.0';
    const url = `${base}/${wabaId}/message_templates?name=${encodeURIComponent(templateName)}&fields=name,status`;

    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        return { approved: false, reason: `Meta API HTTP ${res.status}` };
      }
      const body = (await res.json()) as { data?: { name?: string; status?: string }[] };
      const hit = body.data?.find((t) => t.name === templateName);
      const status = hit?.status ?? 'NOT_FOUND';
      return {
        approved: status === 'APPROVED',
        status,
        reason: hit ? undefined : `Template "${templateName}" não encontrado`,
      };
    } catch (e) {
      return { approved: false, reason: (e as Error).message };
    }
  }
}
