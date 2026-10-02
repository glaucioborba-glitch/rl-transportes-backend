import { Global, Module } from '@nestjs/common';
import { ChaosGateModule } from '../chaos/chaos-gate.module';
import { RedisService } from './redis.service';

@Global()
@Module({
  imports: [ChaosGateModule],
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
