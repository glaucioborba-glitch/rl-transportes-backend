import { Logger, OnModuleInit } from '@nestjs/common';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { Server } from 'socket.io';
import { RealtimeEmitterService } from './realtime-emitter.service';

@WebSocketGateway({
  namespace: '/ws/yard',
  cors: {
    origin: process.env.FRONTEND_ORIGIN ?? process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  },
})
export class YardGateway implements OnGatewayConnection, OnModuleInit {
  private readonly logger = new Logger(YardGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly realtime: RealtimeEmitterService) {}

  onModuleInit(): void {
    this.realtime.registerYardServer(this.server);
  }

  handleConnection(client: Socket): void {
    const clienteId = client.handshake.query.clienteId;
    if (typeof clienteId === 'string' && clienteId.length > 0) {
      void client.join(`cliente:${clienteId}`);
    }
    void client.join('yard-cockpit');
    this.logger.debug(`yard ws connect ${client.id}`);
  }
}
