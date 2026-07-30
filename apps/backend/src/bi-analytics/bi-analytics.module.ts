import { Module, OnModuleInit } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CronAlertModule } from '../common/cron/cron-alert.module';
import { PrismaModule } from '../prisma/prisma.module';
import { WorkforcePlanningModule } from '../workforce-planning/workforce-planning.module';
import { BiAnalyticsCronService } from './bi-analytics-cron.service';
import { BiAnalyticsController } from './bi-analytics.controller';
import { BiAnalyticsRefreshService, BiAnalyticsService } from './bi-analytics.service';

@Module({
  imports: [PrismaModule, ScheduleModule, WorkforcePlanningModule, CronAlertModule],
  controllers: [BiAnalyticsController],
  providers: [BiAnalyticsService, BiAnalyticsRefreshService, BiAnalyticsCronService],
  exports: [BiAnalyticsService, BiAnalyticsRefreshService],
})
export class BiAnalyticsModule implements OnModuleInit {
  constructor(private readonly refresh: BiAnalyticsRefreshService) {}

  /** Primeira carga ao subir o Nest (views vazias até o primeiro refresh). */
  onModuleInit() {
    void this.refresh.refreshAll().catch(() => {
      /* DB pode ainda não ter migration aplicada em dev */
    });
  }
}
