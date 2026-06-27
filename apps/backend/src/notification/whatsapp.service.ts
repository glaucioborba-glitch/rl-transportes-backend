import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RetriableOutboxError } from '../outbox/outbox.errors';
import { maskPhoneE164 } from './whatsapp-phone.util';
import type { WhatsappSendResult, WhatsappTemplateSendParams } from './whatsapp.types';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(private readonly config: ConfigService) {}

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
}
