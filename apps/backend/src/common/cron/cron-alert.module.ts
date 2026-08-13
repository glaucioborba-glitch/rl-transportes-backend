import { Module } from '@nestjs/common';
import { RedisModule } from '../../redis/redis.module';
import { CronAlertService } from './cron-alert.service';

@Module({
  imports: [RedisModule],
  providers: [CronAlertService],
  exports: [CronAlertService],
})
export class CronAlertModule {}
