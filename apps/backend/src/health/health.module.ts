import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TerminusModule } from '@nestjs/terminus';
import { AlertModule } from '../alert/alert.module';
import { CronAlertModule } from '../common/cron/cron-alert.module';
import { FiscalIntegracaoModule } from '../fiscal-integracao/fiscal-integracao.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { DbHealthService } from './db-health.service';
import { HealthAlertService } from './health-alert.service';
import { HealthController } from './health.controller';
import { IpmHealthIndicator } from './indicators/ipm.health';
import { PrismaHealthIndicator } from './indicators/prisma.health';
import { RedisHealthIndicator } from './indicators/redis.health';

@Module({
  imports: [
    TerminusModule,
    ScheduleModule,
    PrismaModule,
    RedisModule,
    CronAlertModule,
    FiscalIntegracaoModule,
    AlertModule,
  ],
  controllers: [HealthController],
  providers: [
    PrismaHealthIndicator,
    RedisHealthIndicator,
    IpmHealthIndicator,
    DbHealthService,
    HealthAlertService,
  ],
  exports: [DbHealthService],
})
export class HealthModule {}
