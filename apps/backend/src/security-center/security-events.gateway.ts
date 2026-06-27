import { Logger, OnModuleInit } from '@nestjs/common';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { SecurityEventsService, type SecurityWsPayload } from './security-events.service';

/**
 * Canal Socket.IO namespace `/ws/security` (cliente: `io(baseUrl + '/ws/security')`).
 * Eventos: RISK_UPDATE, CRITICAL_EVENT, GEO_UPDATE — payload igual ao emitido pelo SecurityEventsService.
 */
@WebSocketGateway({
  namespace: '/ws/security',
  cors: {
    origin: process.env.FRONTEND_ORIGIN ?? process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  },
})
export class SecurityEventsGateway implements OnGatewayConnection, OnModuleInit {
  private readonly logger = new Logger(SecurityEventsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly events: SecurityEventsService) {}

  onModuleInit(): void {
    this.events.events$().subscribe((evt: SecurityWsPayload) => {
      try {
        this.server.emit(evt.type, evt);
        if (evt.type === 'RISK_UPDATE' && evt.userId) {
          this.server.to(`user:${evt.userId}`).emit(evt.type, evt);
        }
        if (evt.type === 'CRITICAL_EVENT') {
          this.server.emit('CRITICAL_EVENT', evt);
        }
      } catch (e) {
        this.logger.warn(`WS emit: ${(e as Error).message}`);
      }
    });
  }

  handleConnection(client: import('socket.io').Socket): void {
    const uid = client.handshake.query.userId;
    if (typeof uid === 'string' && uid.trim()) {
      void client.join(`user:${uid.trim()}`);
    }
    void client.join('staff');
  }
}
