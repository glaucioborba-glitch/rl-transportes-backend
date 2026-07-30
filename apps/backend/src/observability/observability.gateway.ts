import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { RedisService } from '../redis/redis.service';
import { SecurityEventsService } from '../security-center/security-events.service';
import { ObservabilityBridgeService, type ObservabilityWsEvent } from './observability-bridge.service';
import { ObservabilityHealthService } from './observability-health.service';
import { OBS_ERRORS_LIST, OBS_LIVE_LOGS, OBS_WS_CHANNEL } from './observability.constants';
import { inferServiceFromRoute } from './observability-route.util';

/**
 * Namespace `/ws/observability` — em produção lê filas Redis; em dev usa bridge in-process.
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
  private redisPollTimer?: ReturnType<typeof setInterval>;
  private redisUnsub?: () => Promise<void>;
  private lastHealthJson: string | null = null;
  private lastRedisLiveSig: string | null = null;
  private lastRedisErrorSig: string | null = null;
  private readonly isProd: boolean;

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly bridge: ObservabilityBridgeService,
    private readonly securityEvents: SecurityEventsService,
    private readonly health: ObservabilityHealthService,
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.isProd = (config.get<string>('NODE_ENV') ?? 'development') === 'production';
  }

  onModuleInit(): void {
    if (this.isProd) {
      void this.subscribeRedisPubSub();
      void this.pollRedisStreams();
      this.redisPollTimer = setInterval(() => void this.pollRedisStreams(), 30_000);
    } else {
      this.bridge.events$().subscribe((evt: ObservabilityWsEvent) => {
        try {
          this.server.emit(evt.type, evt);
        } catch (e) {
          this.logger.warn(`bridge emit: ${(e as Error).message}`);
        }
      });
    }

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
    if (this.redisPollTimer) clearInterval(this.redisPollTimer);
    void this.redisUnsub?.();
  }

  private async subscribeRedisPubSub(): Promise<void> {
    try {
      this.redisUnsub = await this.redis.subscribe(OBS_WS_CHANNEL, (raw) => {
        try {
          const evt = JSON.parse(raw) as ObservabilityWsEvent;
          if (evt?.type) this.server.emit(evt.type, evt);
        } catch (e) {
          this.logger.warn(`pubsub parse: ${(e as Error).message}`);
        }
      });
      this.logger.log(`Observability WS pub/sub ativo (${OBS_WS_CHANNEL})`);
    } catch (e) {
      this.logger.warn(`pub/sub indisponível — fallback poll: ${(e as Error).message}`);
    }
  }

  handleConnection(client: import('socket.io').Socket): void {
    void client.join('staff-obs');
  }

  private async pollRedisStreams(): Promise<void> {
    try {
      const [liveLines, errorLines] = await Promise.all([
        this.redis.lrange(OBS_LIVE_LOGS, 0, 0),
        this.redis.lrange(OBS_ERRORS_LIST, 0, 0),
      ]);

      const liveSig = liveLines[0] ?? '';
      if (liveSig && liveSig !== this.lastRedisLiveSig) {
        this.lastRedisLiveSig = liveSig;
        const sample = JSON.parse(liveSig) as {
          route: string;
          method: string;
          ms: number;
          status: number;
          at: string;
        };
        this.server.emit('LOG_EVENT', {
          type: 'LOG_EVENT',
          payload: {
            route: sample.route,
            method: sample.method,
            ms: sample.ms,
            status: sample.status,
            at: sample.at,
            service: inferServiceFromRoute(sample.route),
          },
        });
      }

      const errSig = errorLines[0] ?? '';
      if (errSig && errSig !== this.lastRedisErrorSig) {
        this.lastRedisErrorSig = errSig;
        const row = JSON.parse(errSig) as {
          route: string;
          message: string;
          service: string;
          timestamp: string;
          level: string;
        };
        this.server.emit('ERROR_EVENT', {
          type: 'ERROR_EVENT',
          payload: row,
        });
      }
    } catch (e) {
      this.logger.warn(`redis poll: ${(e as Error).message}`);
    }
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
