import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import {
  OBS_ERRORS_LIST,
  OBS_FAIL_HEAT_PREFIX,
  TTL_ERRORS_SEC,
} from './observability.constants';
import { sanitizeObservabilityMessage, stackForEnv } from './observability-sanitize.util';
import { inferServiceFromRoute } from './observability-route.util';
import { ObservabilityBridgeService } from './observability-bridge.service';

export type StoredError = {
  route: string;
  message: string;
  service: string;
  timestamp: string;
  stack?: string;
  level: 'CRITICAL' | 'ERROR' | 'WARNING';
};

function hourKeyUTC(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const h = String(d.getUTCHours()).padStart(2, '0');
  return `${y}${m}${day}${h}`;
}

function truncateRoute(path: string): string {
  const p = path.split('?')[0] || '/';
  return p.length > 220 ? `${p.slice(0, 217)}…` : p;
}

@Injectable()
export class ObservabilityLogsService {
  private readonly logger = new Logger(ObservabilityLogsService.name);
  private readonly isProd: boolean;

  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly bridge: ObservabilityBridgeService,
  ) {
    this.isProd = (this.config.get<string>('NODE_ENV') ?? 'development') === 'production';
  }

  async recordException(input: {
    path: string;
    message: string;
    stack?: string;
    statusCode?: number;
    level?: StoredError['level'];
  }): Promise<void> {
    const route = truncateRoute(input.path);
    const service = inferServiceFromRoute(route);
    const safeMsg = sanitizeObservabilityMessage(input.message);
    const level: StoredError['level'] =
      input.level ??
      (input.statusCode != null && input.statusCode >= 500 ? 'ERROR' : 'WARNING');

    const row: StoredError = {
      route,
      message: safeMsg,
      service,
      timestamp: new Date().toISOString(),
      stack: stackForEnv(input.stack, this.isProd),
      level,
    };

    try {
      await this.redis.lpush(OBS_ERRORS_LIST, JSON.stringify(row));
      await this.redis.ltrim(OBS_ERRORS_LIST, 0, 399);
      await this.redis.expire(OBS_ERRORS_LIST, TTL_ERRORS_SEC);

      const hk = `${OBS_FAIL_HEAT_PREFIX}${hourKeyUTC(new Date())}`;
      await this.redis.hincrby(hk, route, 1);
      await this.redis.expire(hk, 96 * 3600);
    } catch (e) {
      if (!this.isProd) this.logger.warn(`logs redis: ${(e as Error).message}`);
    }

    this.bridge.emit({
      type: 'ERROR_EVENT',
      payload: {
        route: row.route,
        message: row.message,
        service: row.service,
        timestamp: row.timestamp,
        level: row.level,
      },
    });
  }
}
