import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AcaoAuditoria } from '@prisma/client';
import { AuditoriaService } from '../../auditoria/auditoria.service';
import { signWebhookPayload } from '../common/webhook-signature.util';
import type { IntegracaoTipoEvento } from '../integracao-events.constants';
import { IntegracaoEventLogStore } from '../stores/integracao-event-log.store';
import type { WebhookSubscription } from '../stores/webhook-subscription.store';
import { WebhookSubscriptionStore } from '../stores/webhook-subscription.store';
import { automacaoIntegracaoBus } from '../../automacao-processos/automacao-integracao.bus';

export interface EntregaResultado {
  webhookId: string;
  url: string;
  attempts: number;
  ok: boolean;
  status?: number;
  erro?: string;
}

@Injectable()
export class WebhookDeliveryService {
  private readonly logger = new Logger(WebhookDeliveryService.name);

  constructor(
    private readonly subs: WebhookSubscriptionStore,
    private readonly eventLog: IntegracaoEventLogStore,
    private readonly auditoria: AuditoriaService,
    private readonly config: ConfigService,
  ) {}

  private usuarioAuditoria(): string | undefined {
    const id = this.config.get<string>('INTEGRACAO_AUDITORIA_USER_ID')?.trim();
    return id || undefined;
  }

  /** Dispara webhooks inscritos + log interno. `payload` deve ser serializável. */
  async dispatch(params: {
    tipo: IntegracaoTipoEvento;
    payload: Record<string, unknown>;
    clienteId?: string;
    correlationId?: string;
  }): Promise<EntregaResultado[]> {
    const { tipo, payload, clienteId, correlationId } = params;
    const envelope = {
      tipo,
      at: new Date().toISOString(),
      correlationId: correlationId ?? null,
      clienteId: clienteId ?? null,
      payload,
    };
    const rawBody = JSON.stringify(envelope);

    this.eventLog.push({
      tipo,
      payload,
      clienteId,
      correlationId,
    });

    automacaoIntegracaoBus.emit('integracao.evento', {
      tipo,
      payload,
      clienteId,
      correlationId,
    });

    const matched = this.subs.matching(tipo);
    const results: EntregaResultado[] = [];

    for (const sub of matched) {
      const r = await this.deliverSubscription(sub, rawBody);
      results.push(r);
      await this.registrarAuditoriaEntrega(sub, r, tipo);
    }

    return results;
  }

  /** Expõe retry para testes unitários. */
  async deliverSubscription(sub: WebhookSubscription, rawBody: string): Promise<EntregaResultado> {
    const sig = signWebhookPayload(sub.secret, rawBody);
    let lastErr = '';
    let status: number | undefined;
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 12_000);
        const res = await fetch(sub.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Integracao-Signature': sig,
            'X-Integracao-Event': sub.eventos.join(','),
          },
          body: rawBody,
          signal: ctrl.signal,
        });
        clearTimeout(t);
        status = res.status;
        if (res.ok) {
          return {
            webhookId: sub.id,
            url: sub.url,
            attempts: attempt,
            ok: true,
            status,
          };
        }
        lastErr = `HTTP ${res.status}`;
      } catch (e) {
        lastErr = (e as Error).message;
      }
      await delay(400 * attempt * attempt);
    }

    return {
      webhookId: sub.id,
      url: sub.url,
      attempts: maxAttempts,
      ok: false,
      status,
      erro: lastErr,
    };
  }

  private async registrarAuditoriaEntrega(
    sub: WebhookSubscription,
    result: EntregaResultado,
    tipo: IntegracaoTipoEvento,
  ) {
    const usuario = this.usuarioAuditoria();
    if (!usuario) return;
    try {
      await this.auditoria.registrar({
        tabela: 'integracao_webhook_entrega',
        registroId: result.webhookId,
        acao: AcaoAuditoria.SEGURANCA,
        usuario,
        dadosDepois: {
          integrationAudit: true,
          tipoEvento: tipo,
          ok: result.ok,
          attempts: result.attempts,
          url: sub.url,
          status: result.status,
          erro: result.erro,
        },
      });
    } catch (e) {
      this.logger.warn(`Auditoria webhook omitida: ${(e as Error).message}`);
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
