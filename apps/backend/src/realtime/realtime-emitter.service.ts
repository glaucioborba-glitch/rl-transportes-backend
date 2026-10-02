import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';

export type YardUpdatedPayload = {
  clienteId: string;
  atualizadoEm: string;
  pilhasCount: number;
};

export type DispatchUpdatedPayload = {
  source: string;
  processedAt?: string;
  outboxId?: string;
  eventType?: string;
  aggregateId?: string;
  status?: string;
  ordemId?: string;
  board?: unknown;
};

@Injectable()
export class RealtimeEmitterService {
  private yardServer?: Server;
  private dispatchServer?: Server;

  registerYardServer(server: Server): void {
    this.yardServer = server;
  }

  registerDispatchServer(server: Server): void {
    this.dispatchServer = server;
  }

  emitYardUpdated(payload: YardUpdatedPayload): void {
    this.yardServer?.emit('yard_updated', payload);
    this.yardServer?.to(`cliente:${payload.clienteId}`).emit('yard_updated', payload);
  }

  emitDispatchUpdated(payload: DispatchUpdatedPayload): void {
    this.dispatchServer?.emit('dispatch_updated', payload);
  }
}
