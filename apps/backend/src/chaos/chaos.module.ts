import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { ObservabilityModule } from '../observability/observability.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { ResilienceModule } from '../resilience/resilience.module';
import { ChaosController } from './chaos.controller';
import { ChaosInterceptor } from './chaos.interceptor';
import { ChaosService } from './chaos.service';

@Module({
  imports: [PrismaModule, RedisModule, AuditoriaModule, ObservabilityModule, ResilienceModule],
  controllers: [ChaosController],
  providers: [
    ChaosService,
    ChaosInterceptor,
    { provide: APP_INTERCEPTOR, useExisting: ChaosInterceptor },
  ],
})
export class ChaosModule {}
