import { Global, Module } from '@nestjs/common';
import { RedisModule } from '../../redis/redis.module';
import { ConfigCacheService } from './config-cache.service';

@Global()
@Module({
  imports: [RedisModule],
  providers: [ConfigCacheService],
  exports: [ConfigCacheService],
})
export class ConfigCacheModule {}
