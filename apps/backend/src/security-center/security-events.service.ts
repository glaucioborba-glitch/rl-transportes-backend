import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';
import { Subject } from 'rxjs';

export type SecurityWsPayload =
  | { type: 'RISK_UPDATE'; userId?: string; clienteId?: string | null; score?: number; sessionId?: string }
  | {
      type: 'CRITICAL_EVENT';
      alertId?: string;
      userId?: string;
      tipo?: string;
      solicitacaoId?: string;
      contexto?: Record<string, unknown>;
    }
  | { type: 'GEO_UPDATE'; lat?: number; lon?: number; ip?: string };

/**
 * Ponte entre SecurityEngine e gateway WebSocket (sem acoplar IntrusionService ao gateway).
 */
@Injectable()
export class SecurityEventsService {
  private readonly stream = new Subject<SecurityWsPayload>();
  private readonly internalBus = new EventEmitter();

  /** Observável consumido pelo gateway após init. */
  events$() {
    return this.stream.asObservable();
  }

  emit(evt: SecurityWsPayload): void {
    this.stream.next(evt);
  }

  /** Evento interno `security.risk-changed` para jobs/extensões (sem WS). */
  emitRiskChanged(payload: Record<string, unknown>): void {
    this.internalBus.emit('security.risk-changed', payload);
  }

  /**
   * Evento consolidado para o Security Engine — sempre com `solicitacaoId`.
   */
  emitSolicitacaoV2RiscoClassificado(payload: {
    solicitacaoId: string;
    userId?: string;
    clienteId?: string | null;
    sinais: string[];
    device?: Record<string, unknown>;
  }): void {
    this.emit({
      type: 'CRITICAL_EVENT',
      tipo: 'SOLICITACAO_V2_RISCO_CLASSIFICADO',
      solicitacaoId: payload.solicitacaoId,
      userId: payload.userId,
      contexto: {
        clienteId: payload.clienteId ?? null,
        sinais: payload.sinais,
        device: payload.device ?? {},
      },
    });
  }

  get riskChangedEmitter(): EventEmitter {
    return this.internalBus;
  }
}
