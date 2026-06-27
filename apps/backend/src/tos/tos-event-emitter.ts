import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';

/**
 * Subconjunto compatível com EventEmitter2 (@nestjs/event-emitter).
 * Quando o pacote estiver instalável no ambiente, substitua por EventEmitterModule.forRoot().
 */
@Injectable()
export class TosEventEmitter extends EventEmitter {
  override emit(event: string | symbol, ...args: unknown[]): boolean {
    return super.emit(event, ...args);
  }

  override on(event: string | symbol, listener: (...args: unknown[]) => void): this {
    return super.on(event, listener);
  }
}
