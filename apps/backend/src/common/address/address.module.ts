import { Module } from '@nestjs/common';
import { CepCacheModule } from '../../cep-cache/cep-cache.module';
import { RedisModule } from '../../redis/redis.module';
import { AddressController } from './address.controller';
import { AddressService } from './address.service';
import { IbgeService } from './ibge.service';

@Module({
  imports: [RedisModule, CepCacheModule],
  controllers: [AddressController],
  providers: [AddressService, IbgeService],
  exports: [AddressService, IbgeService],
})
export class AddressModule {}
