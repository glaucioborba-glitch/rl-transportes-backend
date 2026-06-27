import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { SecurityCenterModule } from '../security-center/security-center.module';
import { ObservabilityMetricsService } from './metrics.service';
import { ObservabilityLogsService } from './logs.service';
import { ObservabilityPerformanceService } from './performance.service';
import { ObservabilityBridgeService } from './observability-bridge.service';
import { ObservabilityHealthService } from './observability-health.service';
import { ObservabilityGateway } from './observability.gateway';
import { ObservabilityAdminController } from './observability-admin.controller';
import { ObservabilityRateLimitGuard } from './observability-rate-limit.guard';

@Module({
  imports: [PrismaModule, RedisModule, SecurityCenterModule],
  controllers: [ObservabilityAdminController],
  providers: [
    ObservabilityBridgeService,
    ObservabilityMetricsService,
    ObservabilityLogsService,
    ObservabilityPerformanceService,
    ObservabilityHealthService,
    ObservabilityGateway,
    ObservabilityRateLimitGuard,
  ],
  exports: [
    ObservabilityMetricsService,
    ObservabilityLogsService,
    ObservabilityBridgeService,
    ObservabilityRateLimitGuard,
  ],
})
export class ObservabilityModule {}
