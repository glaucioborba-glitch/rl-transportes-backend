import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CronAlertModule } from '../common/cron/cron-alert.module';
import { EmailModule } from '../common/email/email.module';
import { NotificationModule } from '../notification/notification.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TenantModule } from '../tenant/tenant.module';
import { DunningCronService } from './dunning-cron.service';
import { DunningProcessService } from './dunning-process.service';

@Module({
  imports: [ScheduleModule, CronAlertModule, PrismaModule, TenantModule, NotificationModule, EmailModule],
  providers: [DunningProcessService, DunningCronService],
  exports: [DunningProcessService],
})
export class DunningCronModule {}
