import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { SecurityEventsService } from '../security-center/security-events.service';
import { ObservabilityBridgeService, type ObservabilityWsEvent } from './observability-bridge.service';
import { ObservabilityHealthService } from './observability-health.service';

/**
 * Namespace `/ws/observability` — eventos: LOG_EVENT, ERROR_EVENT, HEALTH_UPDATE (mesmo nome do payload.type).
 */
@WebSocketGateway({
  namespace: '/ws/observability',
  cors: {
    origin: process.env.FRONTEND_ORIGIN ?? process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  },
})
export class ObservabilityGateway implements OnGatewayConnection, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ObservabilityGateway.name);
  private healthTimer?: ReturnType<typeof setInterval>;
  private lastHealthJson: string | null = null;

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly bridge: ObservabilityBridgeService,
    private readonly securityEvents: SecurityEventsService,
    private readonly health: ObservabilityHealthService,
  ) {}

  onModuleInit(): void {
    this.bridge.events$().subscribe((evt: ObservabilityWsEvent) => {
      try {
        this.server.emit(evt.type, evt);
      } catch (e) {
        this.logger.warn(`bridge emit: ${(e as Error).message}`);
      }
    });

    this.securityEvents.events$().subscribe((evt) => {
      if (evt.type !== 'CRITICAL_EVENT') return;
      try {
        this.server.emit('ERROR_EVENT', {
          type: 'ERROR_EVENT',
          payload: {
            route: '/security/engine',
            message: 'Security CRITICAL_EVENT',
            service: 'security-center',
            timestamp: new Date().toISOString(),
            level: 'CRITICAL',
            alertId: 'alertId' in evt ? evt.alertId : undefined,
            userId: 'userId' in evt ? evt.userId : undefined,
          },
        });
      } catch (e) {
        this.logger.warn(`security relay: ${(e as Error).message}`);
      }
    });

    void this.emitHealthIfChanged();
    this.healthTimer = setInterval(() => void this.emitHealthIfChanged(), 15_000);
  }

  onModuleDestroy(): void {
    if (this.healthTimer) clearInterval(this.healthTimer);
  }

  handleConnection(client: import('socket.io').Socket): void {
    void client.join('staff-obs');
  }

  private async emitHealthIfChanged(): Promise<void> {
    try {
      const snap = await this.health.snapshot();
      const json = JSON.stringify(snap);
      if (json === this.lastHealthJson) return;
      this.lastHealthJson = json;
      const evt: ObservabilityWsEvent = { type: 'HEALTH_UPDATE', payload: snap as unknown as Record<string, unknown> };
      this.server.emit('HEALTH_UPDATE', evt);
    } catch (e) {
      this.logger.warn(`health poll: ${(e as Error).message}`);
    }
  }
}
