import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { AlertModule } from '../alert/alert.module';
import { FiscalIntegracaoModule } from '../fiscal-integracao/fiscal-integracao.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { HealthController } from './health.controller';
import { IpmHealthIndicator } from './indicators/ipm.health';
import { PrismaHealthIndicator } from './indicators/prisma.health';
import { RedisHealthIndicator } from './indicators/redis.health';

@Module({
  imports: [TerminusModule, PrismaModule, RedisModule, FiscalIntegracaoModule, AlertModule],
  controllers: [HealthController],
  providers: [PrismaHealthIndicator, RedisHealthIndicator, IpmHealthIndicator],
})
export class HealthModule {}
