import { Injectable, Logger } from '@nestjs/common';
import { SecurityEventsService } from '../security-center/security-events.service';

/**
 * Ponte de domínio FL / armazenagem com telemetria do Security Center (sem duplicar IntrusionService).
 */
@Injectable()
export class ServicosLogisticosService {
  private readonly logger = new Logger(ServicosLogisticosService.name);

  constructor(private readonly securityEvents: SecurityEventsService) {}

  notificarBloqueioMovimentacao(ctx: Record<string, unknown>): void {
    this.logger.warn(`Container bloqueado — movimentação negada: ${JSON.stringify(ctx)}`);
    this.securityEvents.emit({ type: 'CRITICAL_EVENT', tipo: 'CONTAINER_MOVIMENTACAO_BLOQUEADA' });
    this.securityEvents.emitRiskChanged({ ...ctx, motivo: 'container_bloqueado' });
  }

  notificarEventoIntegridade(ctx: Record<string, unknown>): void {
    this.logger.warn(`Integridade solicitação — ${JSON.stringify(ctx)}`);
    this.securityEvents.emit({ type: 'CRITICAL_EVENT', tipo: 'SOLICITACAO_INTEGRIDADE' });
    this.securityEvents.emitRiskChanged({ ...ctx, motivo: 'solicitacao_integridade' });
  }
}
