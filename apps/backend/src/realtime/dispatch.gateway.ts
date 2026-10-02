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
  namespace: '/ws/dispatch',
  cors: {
    origin: process.env.FRONTEND_ORIGIN ?? process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  },
})
export class DispatchGateway implements OnGatewayConnection, OnModuleInit {
  private readonly logger = new Logger(DispatchGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly realtime: RealtimeEmitterService) {}

  onModuleInit(): void {
    this.realtime.registerDispatchServer(this.server);
  }

  handleConnection(client: Socket): void {
    void client.join('dispatch-board');
    this.logger.debug(`dispatch ws connect ${client.id}`);
  }
}
