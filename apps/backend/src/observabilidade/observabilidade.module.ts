import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { ObservabilidadeController } from './observabilidade.controller';
import { ObservabilidadeInterceptor } from './observabilidade.interceptor';
import { ObservabilidadeTelemetryStore } from './observabilidade-telemetry.store';
import { ObservabilidadeHealthService } from './observabilidade-health.service';
import { ObservabilidadeService } from './observabilidade.service';
import { ObservabilidadeAccessGuard } from './observabilidade-access.guard';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [ObservabilidadeController],
  providers: [
    ObservabilidadeTelemetryStore,
    ObservabilidadeHealthService,
    ObservabilidadeService,
    ObservabilidadeAccessGuard,
    ObservabilidadeInterceptor,
    { provide: APP_INTERCEPTOR, useExisting: ObservabilidadeInterceptor },
  ],
  exports: [ObservabilidadeTelemetryStore],
})
export class ObservabilidadeModule {}
