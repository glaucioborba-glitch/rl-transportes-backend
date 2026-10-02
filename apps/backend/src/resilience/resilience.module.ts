import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { ObservabilityModule } from '../observability/observability.module';
import { CircuitBreakerService } from './circuit-breaker.service';
import { ResilienceMetricsService } from './resilience-metrics.service';
import { AutoRecoveryService } from './auto-recovery.service';
import { ResilienceInterceptor } from './resilience.interceptor';
import { ResilienceObservabilityController } from './resilience-observability.controller';

@Module({
  imports: [PrismaModule, RedisModule, ObservabilityModule],
  controllers: [ResilienceObservabilityController],
  providers: [
    ResilienceMetricsService,
    CircuitBreakerService,
    AutoRecoveryService,
    ResilienceInterceptor,
    { provide: APP_INTERCEPTOR, useExisting: ResilienceInterceptor },
  ],
  exports: [CircuitBreakerService, ResilienceMetricsService, AutoRecoveryService],
})
export class ResilienceModule {}
