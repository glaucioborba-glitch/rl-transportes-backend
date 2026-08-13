import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { SecurityAnalyticsService } from '../security-center/security-analytics.service';
import { ObservabilityPerformanceService } from './performance.service';
import { ObservabilityHealthService } from './observability-health.service';
import { ObservabilityRateLimitGuard } from './observability-rate-limit.guard';
import { OBS_LIVE_LOGS } from './observability.constants';
import { RedisService } from '../redis/redis.service';
import type { LatencySample } from './metrics.service';

@ApiTags('admin-observability')
@ApiBearerAuth('access-token')
@Controller('admin/observability')
@UseGuards(AuthGuard('jwt'), RolesGuard, ObservabilityRateLimitGuard)
@Roles(Role.ADMIN)
export class ObservabilityAdminController {
  constructor(
    private readonly performance: ObservabilityPerformanceService,
    private readonly health: ObservabilityHealthService,
    private readonly prisma: PrismaService,
    private readonly analytics: SecurityAnalyticsService,
    private readonly redis: RedisService,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Health agregado (API, DB, Redis, filas, security engine, portal)' })
  async healthEndpoint() {
    return this.health.snapshot();
  }

  @Get('latency')
  @ApiOperation({ summary: 'Últimas latências + agregados P95/P99' })
  async latency() {
    const [recent, aggregates] = await Promise.all([
      this.performance.getLatencyRecent(),
      this.performance.getLatencyAggregates(),
    ]);
    return { recent, aggregates };
  }

  @Get('errors')
  @ApiOperation({ summary: 'Últimos erros registados (Redis)' })
  async errors() {
    const items = await this.performance.listErrors(100);
    return { items };
  }

  @Get('services')
  @ApiOperation({ summary: 'Ranking de rotas, usuários ativos e throughput/min' })
  async services() {
    const [ranking, topUsers, throughputPerMinute] = await Promise.all([
      this.performance.getServicesRanking(40),
      this.performance.getTopUsers(20),
      this.performance.getThroughputSeries(60),
    ]);
    return { ranking, topUsers, throughputPerMinute };
  }

  @Get('security')
  @ApiOperation({ summary: 'Resumo Security Engine / alertas recentes' })
  async securityReport() {
    const since24 = new Date(Date.now() - 24 * 3600 * 1000);
    const [metrics, mx, criticos, fpAlerts] = await Promise.all([
      this.analytics.getGlobalSecurityMetrics(),
      this.analytics.riskMatrix(),
      this.prisma.securityAlert.count({
        where: { createdAt: { gte: since24 }, tipo: 'CRÍTICO' },
      }),
      this.prisma.securityAlert.count({
        where: {
          createdAt: { gte: since24 },
          tipo: { contains: 'fingerprint', mode: 'insensitive' },
        },
      }),
    ]);

    const sessoesQuedaApprox = metrics.loginsFalha24h;

    return {
      eventosCriticos24h: criticos,
      inconsistenciaFingerprint24h: fpAlerts,
      anomaliasDetectadas24h: metrics.alertas24h,
      quedasSessaoProxy: sessoesQuedaApprox,
      fingerprintsBloqueados: mx.fingerprintsBloqueados,
      scoreAmbiente: mx.scoreAmbiente,
      porSeveridade: mx.porSeveridade,
    };
  }

  @Get('heatmap')
  @ApiOperation({ summary: 'Heatmap de falhas 24h (Redis)' })
  async heatmap() {
    return this.performance.getFailureHeatmap24h();
  }

  @Get('live')
  @ApiOperation({ summary: 'Últimos eventos de request (Redis list)' })
  async liveLogs() {
    try {
      const raw = await this.redis.lrange(OBS_LIVE_LOGS, 0, 99);
      const items: LatencySample[] = [];
      for (const line of raw) {
        try {
          items.push(JSON.parse(line) as LatencySample);
        } catch {
          /* */
        }
      }
      return { items };
    } catch {
      return { items: [] as LatencySample[] };
    }
  }
}
