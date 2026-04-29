import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { IntegracaoApiKeyStore } from '../stores/integracao-api-key.store';
import { IntegracaoRateLimitService } from '../services/integracao-rate-limit.service';

type ReqClienteApi = Request & { integracaoClienteId?: string };

/** API Key (`X-Api-Key`) **ou** JWT com papel CLIENTE (portal). Define `req.integracaoClienteId`. */
@Injectable()
export class ClienteApiAuthGuard implements CanActivate {
  constructor(
    private readonly apiKeys: IntegracaoApiKeyStore,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly rate: IntegracaoRateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<ReqClienteApi>();
    const rawKey = req.headers['x-api-key'] ?? req.headers['X-Api-Key'];
    const apiKey = typeof rawKey === 'string' ? rawKey : Array.isArray(rawKey) ? rawKey[0] : '';

    if (apiKey) {
      const clienteId = this.apiKeys.resolveClienteId(apiKey);
      if (!clienteId) throw new UnauthorizedException('API Key inválida ou não mapeada.');
      if (!this.rate.consume(`ak:${apiKey.slice(0, 16)}`)) {
        throw new ForbiddenException('Rate limit de integração excedido.');
      }
      req.integracaoClienteId = clienteId;
      return true;
    }

    const rawAuth = req.headers.authorization;
    const auth = typeof rawAuth === 'string' ? rawAuth : Array.isArray(rawAuth) ? rawAuth[0] : '';
    if (!auth.startsWith('Bearer ')) throw new UnauthorizedException();
    const token = auth.slice(7);
    const secret =
      this.config.get<string>('secrets.jwtSecret') ?? this.config.getOrThrow<string>('JWT_SECRET');
    let payload: JwtPayload;
    try {
      payload = this.jwt.verify<JwtPayload>(token, { secret });
    } catch {
      throw new UnauthorizedException();
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException();
    const payloadTv = payload.tv ?? 0;
    if (user.tokenVersion !== payloadTv) throw new UnauthorizedException();
    if (user.role !== Role.CLIENTE || !user.clienteId) {
      throw new ForbiddenException('Rota exclusiva para cliente autenticado (JWT CLIENTE ou API Key).');
    }
    if (!this.rate.consume(`jwt:${user.clienteId}`)) {
      throw new ForbiddenException('Rate limit de integração excedido.');
    }
    req.integracaoClienteId = user.clienteId;
    return true;
  }
}
