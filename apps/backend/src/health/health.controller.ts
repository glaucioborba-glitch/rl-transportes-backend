import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
  HealthCheckError,
} from '@nestjs/terminus';
import { probeSecurityEngineStatus } from './security-engine-probe.util';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import type { UnifiedHealthResponse } from './health-response.types';
import { PrismaHealthIndicator } from './indicators/prisma.health';
import { RedisHealthIndicator } from './indicators/redis.health';
import { IpmHealthIndicator } from './indicators/ipm.health';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: PrismaHealthIndicator,
    private readonly redisIndicator: RedisHealthIndicator,
    private readonly ipm: IpmHealthIndicator,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Terminus — PostgreSQL, Redis e IPM (Prefeitura).
   * Retorna 503 se alguma dependência crítica estiver down (load balancer / K8s).
   */
  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Health check Terminus (DB, Redis, IPM)' })
  async check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.db.ping('database'),
      () => this.redisIndicator.ping('redis'),
      () => this.ipm.ping('fiscal_ipm'),
    ]);
  }

  /** Payload legado + security engine — sempre 200 (diagnóstico operacional). */
  @Get('diagnostic')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Diagnóstico estendido (não derruba load balancer)' })
  async diagnostic(): Promise<UnifiedHealthResponse> {
    const timestamp = new Date().toISOString();
    let database: 'ok' | 'offline' = 'offline';
    let redisStatus: 'ok' | 'offline' = 'offline';
    let securityEngine: 'ok' | 'degraded' | 'offline' = 'offline';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = 'ok';
    } catch {
      database = 'offline';
    }

    try {
      const pong = await this.redis.ping();
      redisStatus = pong === 'PONG' ? 'ok' : 'offline';
    } catch {
      redisStatus = 'offline';
    }

    try {
      if (redisStatus === 'offline') {
        securityEngine = 'offline';
      } else {
        securityEngine = await probeSecurityEngineStatus(this.redis, this.prisma);
      }
    } catch {
      securityEngine = 'offline';
    }

    let terminus: HealthCheckResult | { status: string; details?: unknown };
    try {
      terminus = await this.check();
    } catch (e) {
      if (e instanceof HealthCheckError) {
        terminus = { status: 'error', details: e.causes };
      } else {
        terminus = { status: 'error', details: (e as Error).message };
      }
    }

    return {
      api: 'ok',
      database,
      redis: redisStatus,
      securityEngine,
      timestamp,
      terminus,
    };
  }
}
