import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../common/email/email.service';
import {
  resolveDebounceAlertaMs,
  resolveWebhookAlerta,
} from '../common/email/resolve-canal-alerta.util';
import { TenantAvisosService } from '../common/email/tenant-avisos.service';
import type { AlertPayload } from './alert.types';

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);
  private readonly lastSent = new Map<string, number>();

  constructor(
    private readonly config: ConfigService,
    private readonly avisos: TenantAvisosService,
    private readonly email: EmailService,
  ) {}

  private shouldSend(key: string, debounceMs: number): boolean {
    const last = this.lastSent.get(key) ?? 0;
    const now = Date.now();
    if (now - last < debounceMs) return false;
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

  private async postWebhook(url: string, payload: AlertPayload): Promise<boolean> {
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

  private corpoEmail(payload: AlertPayload): string {
    return [
      payload.message,
      '',
      `Severidade: ${payload.severity === 'critical' ? 'Crítico' : 'Atenção'}`,
      ...(payload.traceId ? [`Trace: ${payload.traceId}`] : []),
    ].join('\n');
  }

  /**
   * Avisa a equipe do terminal por webhook e por e-mail, com debounce por chave.
   * Canais e destinos vêm de Parâmetros → Notificações; o .env é a reserva.
   */
  async notify(payload: AlertPayload): Promise<boolean> {
    this.logger.warn(
      `[${payload.severity.toUpperCase()}] ${payload.title} — ${payload.message}` +
        (payload.traceId ? ` (traceId=${payload.traceId})` : ''),
    );

    const tenant = await this.avisos.carregar();
    const webhook = resolveWebhookAlerta(
      { url: tenant.webhookUrl, habilitado: tenant.webhookHabilitado },
      this.config.get<string>('ALERT_WEBHOOK_URL'),
    );
    const temEmail = tenant.emailsAlerta.length > 0 || Boolean(this.destinoEmailNoEnv());

    if (!webhook.url && !temEmail) {
      this.logger.debug('Sem webhook nem e-mail de alerta configurado — alerta apenas em log');
      return false;
    }

    const debounceMs = resolveDebounceAlertaMs(
      tenant.debounceAlertasMin,
      this.config.get<string>('ALERT_DEBOUNCE_MS'),
    );
    if (!this.shouldSend(payload.key, debounceMs)) {
      this.logger.debug(`Alerta ${payload.key} suprimido (debounce)`);
      return false;
    }

    const webhookOk = webhook.url ? await this.postWebhook(webhook.url, payload) : false;
    const emailResultado = temEmail
      ? await this.email.sendAlertaInterno({
          assunto: payload.title,
          corpoTexto: this.corpoEmail(payload),
        })
      : null;

    return webhookOk || emailResultado?.enviado === true;
  }

  private destinoEmailNoEnv(): string {
    return (
      this.config.get<string>('FINANCEIRO_NOTIFY_EMAIL')?.trim() ||
      this.config.get<string>('SMTP_FINANCEIRO_TO')?.trim() ||
      ''
    );
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

  async dbUnavailable(input: { latencyMs: number; activeConnections?: number }): Promise<void> {
    await this.notify({
      key: 'db_unavailable',
      severity: 'critical',
      title: '🚨 PostgreSQL Indisponível',
      message: `Banco de dados inacessível. Latência: ${input.latencyMs}ms.`,
      meta: input,
    });
  }

  async poolDegraded(input: { latencyMs: number; activeConnections: number }): Promise<void> {
    await this.notify({
      key: 'db_pool_degraded',
      severity: 'warning',
      title: '⚠️ Pool de Conexões Degradado',
      message: `${input.activeConnections} conexões ativas, latência ${input.latencyMs}ms.`,
      meta: input,
    });
  }

  async faturamentoReconcileFailed(input: {
    falhas: number;
    consolidados: number;
    amostras: Array<{ unidadeProcessoId: string; numero: number | null; erro: string }>;
  }): Promise<void> {
    const sample = input.amostras
      .map((a) => `ID ${a.numero ?? a.unidadeProcessoId}: ${a.erro}`)
      .join(' | ');
    await this.notify({
      key: 'faturamento_reconcile_failed',
      severity: 'critical',
      title: 'Pré-fatura aberta após saída do ID',
      message: `${input.falhas} ciclo(s) não consolidaram (${input.consolidados} ok). ${sample}`.slice(0, 1500),
      meta: { falhas: input.falhas, consolidados: input.consolidados },
    });
  }
}
