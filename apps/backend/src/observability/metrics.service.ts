import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { inferServiceFromRoute } from './observability-route.util';
import {
  OBS_LATENCY_LIST,
  OBS_LIVE_LOGS,
  OBS_ROUTE_RANK_Z,
  OBS_THROUGHPUT_MIN_PREFIX,
  OBS_USER_RANK_Z,
  TTL_METRICS_SEC,
} from './observability.constants';
import { ObservabilityBridgeService } from './observability-bridge.service';

export type LatencySample = {
  route: string;
  method: string;
  ms: number;
  status: number;
  userId?: string;
  at: string;
};

@Injectable()
export class ObservabilityMetricsService {
  private readonly logger = new Logger(ObservabilityMetricsService.name);
  private readonly isProd: boolean;

  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly bridge: ObservabilityBridgeService,
  ) {
    this.isProd = (this.config.get<string>('NODE_ENV') ?? 'development') === 'production';
  }

  /**
   * Regista latência, ranking de rotas, throughput por minuto e atividade de usuário.
   * Falhas Redis não derrubam a requisição.
   */
  async recordHttpRoundtrip(input: {
    path: string;
    method: string;
    statusCode: number;
    durationMs: number;
    usuarioId?: string;
  }): Promise<void> {
    const route = input.path?.split('?')[0] || '/';
    const sample: LatencySample = {
      route,
      method: input.method,
      ms: input.durationMs,
      status: input.statusCode,
      userId: input.usuarioId,
      at: new Date().toISOString(),
    };

    try {
      const line = JSON.stringify(sample);
      await this.redis.lpush(OBS_LATENCY_LIST, line);
      await this.redis.ltrim(OBS_LATENCY_LIST, 0, 99);
      await this.redis.expire(OBS_LATENCY_LIST, TTL_METRICS_SEC);

      await this.redis.zincrby(OBS_ROUTE_RANK_Z, 1, route);
      await this.redis.expire(OBS_ROUTE_RANK_Z, TTL_METRICS_SEC);

      const minuteBucket = Math.floor(Date.now() / 60_000);
      const tpKey = `${OBS_THROUGHPUT_MIN_PREFIX}${minuteBucket}`;
      await this.redis.incr(tpKey);
      await this.redis.expire(tpKey, 180);

      if (input.usuarioId) {
        await this.redis.zincrby(OBS_USER_RANK_Z, 1, input.usuarioId);
        await this.redis.expire(OBS_USER_RANK_Z, TTL_METRICS_SEC);
      }

      await this.redis.lpush(OBS_LIVE_LOGS, line);
      await this.redis.ltrim(OBS_LIVE_LOGS, 0, 99);
      await this.redis.expire(OBS_LIVE_LOGS, TTL_METRICS_SEC);
    } catch (e) {
      if (!this.isProd) this.logger.warn(`metrics redis: ${(e as Error).message}`);
    }

    const emitLog =
      input.statusCode >= 400 || input.durationMs >= 1200 || input.statusCode >= 500;
    if (emitLog) {
      this.bridge.emit({
        type: 'LOG_EVENT',
        payload: {
          route,
          method: input.method,
          ms: input.durationMs,
          status: input.statusCode,
          at: sample.at,
          service: inferServiceFromRoute(route),
        },
      });
    }
  }
}
