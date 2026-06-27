import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AlertPayload } from './alert.types';

const DEFAULT_DEBOUNCE_MS = 15 * 60 * 1000;

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);
  private readonly lastSent = new Map<string, number>();

  constructor(private readonly config: ConfigService) {}

  private webhookUrl(): string | null {
    const url = this.config.get<string>('ALERT_WEBHOOK_URL')?.trim();
    return url || null;
  }

  private debounceMs(): number {
    const raw = this.config.get<string>('ALERT_DEBOUNCE_MS');
    const n = raw ? parseInt(raw, 10) : DEFAULT_DEBOUNCE_MS;
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_DEBOUNCE_MS;
  }

  private shouldSend(key: string): boolean {
    const last = this.lastSent.get(key) ?? 0;
    const now = Date.now();
    if (now - last < this.debounceMs()) return false;
    this.lastSent.set(key, now);
    return true;
  }

  private formatBody(payload: AlertPayload): Record<string, unknown> {
    const fmt = (this.config.get<string>('ALERT_WEBHOOK_FORMAT') ?? 'slack').toLowerCase();
    const text = `${payload.title}\n${payload.message}`;
    if (fmt === 'discord') {
      return { content: text };
    }
    if (fmt === 'teams') {
      return {
        '@type': 'MessageCard',
        '@context': 'https://schema.org/extensions',
        summary: payload.title,
        themeColor: payload.severity === 'critical' ? 'E81123' : 'FFA500',
        title: payload.title,
        text: payload.message,
      };
    }
    return { text };
  }

  /** Dispara webhook (Slack/Discord/Teams) com debounce por chave. */
  async notify(payload: AlertPayload): Promise<boolean> {
    this.logger.warn(
      `[${payload.severity.toUpperCase()}] ${payload.title} — ${payload.message}` +
        (payload.traceId ? ` (traceId=${payload.traceId})` : ''),
    );

    const url = this.webhookUrl();
    if (!url) {
      this.logger.debug('ALERT_WEBHOOK_URL não configurado — alerta apenas em log');
      return false;
    }
    if (!this.shouldSend(payload.key)) {
      this.logger.debug(`Alerta ${payload.key} suprimido (debounce)`);
      return false;
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.formatBody(payload)),
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) {
        this.logger.error(`Webhook alerta HTTP ${res.status}`);
        return false;
      }
      return true;
    } catch (e) {
      this.logger.error(`Falha ao enviar webhook de alerta: ${(e as Error).message}`);
      return false;
    }
  }

  async fiscalIpmDown(details?: { latencyMs?: number; reason?: string }): Promise<void> {
    await this.notify({
      key: 'fiscal_ipm_down',
      severity: 'critical',
      title: '🚨 ALERTA: Integração Fiscal inoperante',
      message:
        'Integração Fiscal inoperante. Feature Flag de contingência recomendada.' +
        (details?.reason ? ` Motivo: ${details.reason}.` : '') +
        (details?.latencyMs != null ? ` Latência: ${details.latencyMs}ms.` : ''),
      meta: details,
    });
  }

  async outboxNfseConsecutiveFailures(input: {
    outboxId: string;
    attempts: number;
    error: string;
    traceId?: string;
  }): Promise<void> {
    await this.notify({
      key: 'outbox_nfse_consecutive_failures',
      severity: 'critical',
      title: '🚨 ALERTA: Outbox NFS-e falhou repetidamente',
      message: `Outbox ${input.outboxId} falhou ${input.attempts}x consecutivas ao emitir NFS-e. Erro: ${input.error.slice(0, 500)}`,
      traceId: input.traceId,
      meta: { outboxId: input.outboxId, attempts: input.attempts },
    });
  }

  async gateQrSlow(input: { ms: number; url: string; traceId?: string }): Promise<void> {
    await this.notify({
      key: 'gate_qr_slow',
      severity: 'warning',
      title: '⚠️ Gate QR lento',
      message: `GET ${input.url} levou ${input.ms}ms (limite 2000ms). Investigar latência do Gate.`,
      traceId: input.traceId,
      meta: { ms: input.ms },
    });
  }
}
