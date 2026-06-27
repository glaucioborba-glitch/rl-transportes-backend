import { Module } from '@nestjs/common';
import { RedisModule } from '../../redis/redis.module';
import { DeviceService } from './device.service';
import { SessionService } from './session.service';

@Module({
  imports: [RedisModule],
  providers: [SessionService, DeviceService],
  exports: [SessionService, DeviceService],
})
export class SessionModule {}
