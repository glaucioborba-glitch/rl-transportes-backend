import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { probeSecurityEngineStatus } from '../health/security-engine-probe.util';
import { OBS_HEALTH_SNAPSHOT, TTL_HEALTH_SNAPSHOT_SEC } from './observability.constants';

export type AdminHealthPayload = {
  api: 'ok' | 'degraded' | 'offline';
  database: 'ok' | 'degraded' | 'offline';
  redis: 'ok' | 'degraded' | 'offline';
  queues: 'ok' | 'degraded' | 'offline' | 'not_configured';
  securityEngine: 'ok' | 'degraded' | 'offline';
  portal: 'ok' | 'degraded' | 'offline';
  timestamp: string;
};

@Injectable()
export class ObservabilityHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async snapshot(): Promise<AdminHealthPayload> {
    const timestamp = new Date().toISOString();

    let dbMs: number | null = null;
    let dbOk = false;
    try {
      const t0 = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      dbMs = Date.now() - t0;
      dbOk = true;
    } catch {
      dbOk = false;
    }

    let redisMs: number | null = null;
    let redisOk = false;
    try {
      const t0 = Date.now();
      const pong = await this.redis.ping();
      redisMs = Date.now() - t0;
      redisOk = pong === 'PONG';
    } catch {
      redisOk = false;
    }

    let securityEngine: AdminHealthPayload['securityEngine'] = 'offline';
    try {
      if (!redisOk) securityEngine = 'offline';
      else securityEngine = await probeSecurityEngineStatus(this.redis, this.prisma);
    } catch {
      securityEngine = 'offline';
    }

    const database: AdminHealthPayload['database'] = !dbOk
      ? 'offline'
      : dbMs != null && dbMs > 800
        ? 'degraded'
        : 'ok';

    const redisStatus: AdminHealthPayload['redis'] = !redisOk
      ? 'offline'
      : redisMs != null && redisMs > 200
        ? 'degraded'
        : 'ok';

    const portal: AdminHealthPayload['portal'] =
      redisStatus === 'offline' || securityEngine === 'offline'
        ? 'offline'
        : securityEngine === 'degraded' || redisStatus === 'degraded'
          ? 'degraded'
          : 'ok';

    const api: AdminHealthPayload['api'] =
      database === 'offline' || redisStatus === 'offline' ? 'offline' : 'ok';

    const payload: AdminHealthPayload = {
      api,
      database,
      redis: redisStatus,
      queues: 'not_configured',
      securityEngine,
      portal,
      timestamp,
    };

    try {
      await this.redis.setex(OBS_HEALTH_SNAPSHOT, TTL_HEALTH_SNAPSHOT_SEC, JSON.stringify(payload));
    } catch {
      /* */
    }

    return payload;
  }
}
