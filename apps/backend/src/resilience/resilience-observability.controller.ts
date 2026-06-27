import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { ObservabilityRateLimitGuard } from '../observability/observability-rate-limit.guard';
import { CircuitBreakerService } from './circuit-breaker.service';
import { ResilienceMetricsService } from './resilience-metrics.service';

@ApiTags('admin-observability')
@ApiBearerAuth('access-token')
@Controller('admin/observability')
@UseGuards(AuthGuard('jwt'), RolesGuard, ObservabilityRateLimitGuard)
@Roles(Role.ADMIN)
export class ResilienceObservabilityController {
  constructor(
    private readonly circuit: CircuitBreakerService,
    private readonly metrics: ResilienceMetricsService,
  ) {}

  @Get('resilience')
  @ApiOperation({
    summary: 'Circuit breaker, fallbacks e auto-recovery (métricas Redis)',
  })
  async resilienceDashboard() {
    const [circuits, dash] = await Promise.all([
      this.circuit.listStates(),
      this.metrics.getDashboardSnapshot(),
    ]);

    const openServices = Object.entries(circuits)
      .filter(([, v]) => v.phase === 'OPEN')
      .map(([k]) => k);

    return {
      circuits,
      openServices,
      fallbackCountByService: dash.fallbackCountByService,
      circuitOpenStats: dash.circuitOpenStats,
      timeline: dash.timeline,
      recoveryLog: dash.recoveryLog,
    };
  }
}
