import { Controller, Get, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
  HealthCheckError,
} from '@nestjs/terminus';
import { probeSecurityEngineStatus } from './security-engine-probe.util';
import { CronAlertService } from '../common/cron/cron-alert.service';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import type { UnifiedHealthResponse } from './health-response.types';
import { DbHealthService } from './db-health.service';
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
    private readonly cronAlert: CronAlertService,
    private readonly dbHealth: DbHealthService,
  ) {}

  /**
   * Terminus — só dependências que o sistema precisa para responder: PostgreSQL e Redis.
   * A prefeitura (IPM) fica no /health/diagnostic: se ela cair, o terminal continua operando
   * em contingência e o load balancer não deve tirar a aplicação do ar.
   */
  @Get()
  @Public()
  @HealthCheck()
  @ApiOperation({ summary: 'Health check Terminus (DB e Redis)' })
  async check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.db.ping('database'),
      () => this.redisIndicator.ping('redis'),
    ]);
  }

  /** Health check proativo PostgreSQL (latência + conexões ativas). */
  @Get('db')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Saúde do pool PostgreSQL (latência e conexões)' })
  async dbPoolHealth() {
    const result = await this.dbHealth.checkConnection();
    return { timestamp: new Date().toISOString(), ...result };
  }

  /** Diagnóstico operacional — só staff (não usar em probe de load balancer). */
  @Get('diagnostic')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(Role.ADMIN, Role.GERENTE, Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Diagnóstico estendido (autenticado)' })
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
      redisStatus = pong === 'PONG' && !this.redis.isMemoryFallback() ? 'ok' : 'offline';
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

    // A prefeitura saiu do /health público: quem acompanha o IPM é este diagnóstico.
    let fiscalIpm: { status: 'ok' | 'offline'; detalhe?: string };
    try {
      await this.ipm.ping('fiscal_ipm');
      fiscalIpm = { status: 'ok' };
    } catch (e) {
      fiscalIpm = {
        status: 'offline',
        detalhe: e instanceof Error ? e.message : String(e),
      };
    }

    return {
      api: 'ok',
      database,
      redis: redisStatus,
      securityEngine,
      fiscalIpm,
      timestamp,
      terminus,
      crons: await this.cronAlert.getStatuses(),
    };
  }

  @Get('crons')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(Role.ADMIN, Role.GERENTE, Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Última execução dos CRONs (autenticado)' })
  async crons() {
    return { timestamp: new Date().toISOString(), jobs: await this.cronAlert.getStatuses() };
  }
}
