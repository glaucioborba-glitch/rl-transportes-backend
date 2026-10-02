import { Module } from '@nestjs/common';
import { RedisModule } from '../../redis/redis.module';
import { TenantModule } from '../../tenant/tenant.module';
import { DeviceService } from './device.service';
import { SessionService } from './session.service';

@Module({
  imports: [RedisModule, TenantModule],
  providers: [SessionService, DeviceService],
  exports: [SessionService, DeviceService],
})
export class SessionModule {}
