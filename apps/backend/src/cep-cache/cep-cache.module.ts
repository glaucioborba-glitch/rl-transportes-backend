import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { IbgeService } from '../common/address/ibge.service';
import { ObservabilityModule } from '../observability/observability.module';
import { RedisModule } from '../redis/redis.module';
import { CepCacheController } from './cep-cache.controller';
import { CepCacheService } from './cep-cache.service';

@Module({
  imports: [RedisModule, ConfigModule, ObservabilityModule],
  controllers: [CepCacheController],
  providers: [CepCacheService, IbgeService],
  exports: [CepCacheService],
})
export class CepCacheModule {}
