import { Global, Module } from '@nestjs/common';
import { DispatchGateway } from './dispatch.gateway';
import { RealtimeEmitterService } from './realtime-emitter.service';
import { YardGateway } from './yard.gateway';

@Global()
@Module({
  providers: [RealtimeEmitterService, YardGateway, DispatchGateway],
  exports: [RealtimeEmitterService],
})
export class RealtimeModule {}
