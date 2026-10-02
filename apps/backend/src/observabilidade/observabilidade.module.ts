import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ObservabilityModule } from '../observability/observability.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { ObservabilidadeController } from './observabilidade.controller';
import { ObservabilidadeInterceptor } from './observabilidade.interceptor';
import { ObservabilidadeHealthService } from './observabilidade-health.service';
import { ObservabilidadeService } from './observabilidade.service';
import { ObservabilidadeAccessGuard } from './observabilidade-access.guard';

/**
 * Produção: telemetria persiste em Redis (ObservabilityModule + store Redis-backed).
 * Dev: Redis quando disponível + buffer in-memory como fallback local.
 */
@Module({
  imports: [PrismaModule, RedisModule, ObservabilityModule],
  controllers: [ObservabilidadeController],
  providers: [
    ObservabilidadeHealthService,
    ObservabilidadeService,
    ObservabilidadeAccessGuard,
    ObservabilidadeInterceptor,
    { provide: APP_INTERCEPTOR, useExisting: ObservabilidadeInterceptor },
  ],
  exports: [ObservabilityModule],
})
export class ObservabilidadeModule {}
