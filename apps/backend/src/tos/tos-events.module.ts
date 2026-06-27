import { Module } from '@nestjs/common';
import { TosEventEmitter } from './tos-event-emitter';

/** Event bus leve compartilhado (TOS + Agendamentos) sem dependências circulares. */
@Module({
  providers: [TosEventEmitter],
  exports: [TosEventEmitter],
})
export class TosEventsModule {}
