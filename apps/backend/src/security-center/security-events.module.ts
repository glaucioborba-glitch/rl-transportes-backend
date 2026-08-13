import { Module } from '@nestjs/common';
import { SecurityEventsGateway } from './security-events.gateway';
import { SecurityEventsService } from './security-events.service';

@Module({
  providers: [SecurityEventsService, SecurityEventsGateway],
  exports: [SecurityEventsService],
})
export class SecurityEventsModule {}
