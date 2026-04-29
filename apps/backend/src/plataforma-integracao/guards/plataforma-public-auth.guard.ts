import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PlataformaServicoId } from '../plataforma.types';
import { PLATAFORMA_SERVICO_KEY } from '../decorators/plataforma-servico.decorator';
import { PlataformaApiClientStore } from '../stores/plataforma-api-client.store';
import { PlataformaConsumptionStore } from '../stores/plataforma-consumption.store';
import { PlataformaRateLimitService } from '../services/plataforma-rate-limit.service';

export type PlataformaHttpReq = {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: { remoteAddress?: string };
  plataformaCliente?: import('../plataforma.types').PlataformaApiClient;
  plataformaTenantId?: string;
};

@Injectable()
export class PlataformaPublicAuthGuard implements CanActivate {
  constructor(
    private readonly clients: PlataformaApiClientStore,
    private readonly rate: PlataformaRateLimitService,
    private readonly consumo: PlataformaConsumptionStore,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<PlataformaHttpReq>();
    const rawKey = req.headers['x-public-api-key'] ?? req.headers['X-Public-Api-Key'];
    const rawSec =
      req.headers['x-public-api-secret'] ?? req.headers['X-Public-Api-Secret'];
    const apiKey = typeof rawKey === 'string' ? rawKey : Array.isArray(rawKey) ? rawKey[0] : '';
    const secret = typeof rawSec === 'string' ? rawSec : Array.isArray(rawSec) ? rawSec[0] : '';

    if (!apiKey || !secret) {
      this.consumo.registrarIncidente('auth_falha', 'Headers X-Public-Api-Key / Secret ausentes');
      throw new UnauthorizedException({
        success: false,
        error: { code: 'AUTH_REQUIRED', message: 'Credenciais públicas obrigatórias.' },
      });
    }

    const client = this.clients.obterPorApiKey(apiKey);
    if (!client || !client.enabled) {
      this.consumo.registrarIncidente('auth_falha', 'API Key inválida ou desativada');
      throw new UnauthorizedException({
        success: false,
        error: { code: 'INVALID_API_KEY', message: 'API Key inválida ou desativada.' },
      });
    }

    if (!this.clients.validarSecret(client, secret)) {
      this.consumo.registrarIncidente('auth_falha', 'Secret incorreto');
      throw new UnauthorizedException({
        success: false,
        error: { code: 'INVALID_SECRET', message: 'Client secret incorreto.' },
      });
    }

    if (!this.rate.consume(client)) {
      throw new HttpException(
        {
          success: false,
          error: { code: 'RATE_LIMIT', message: 'Limite de requis por minuto excedido para este cliente.' },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const rawTenant = req.headers['x-tenant-id'] ?? req.headers['X-Tenant-ID'];
    const tenantHeader =
      typeof rawTenant === 'string' ? rawTenant : Array.isArray(rawTenant) ? rawTenant[0] : '';
    req.plataformaTenantId = (tenantHeader || client.tenantId || 'default').trim();
    req.plataformaCliente = client;

    const servico = this.reflector.getAllAndOverride<PlataformaServicoId | undefined>(
      PLATAFORMA_SERVICO_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (servico && !this.clients.temServico(client, servico)) {
      throw new ForbiddenException({
        success: false,
        error: {
          code: 'SERVICO_NAO_ASSINADO',
          message: `Serviço de marketplace não habilitado para esta API: ${servico}`,
        },
      });
    }

    return true;
  }
}
