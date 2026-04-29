import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { PlataformaApiClient } from '../plataforma.types';
import type { PlataformaHttpReq } from '../guards/plataforma-public-auth.guard';

export const PlataformaClient = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PlataformaApiClient | undefined => {
    const req = ctx.switchToHttp().getRequest<PlataformaHttpReq>();
    return req.plataformaCliente;
  },
);

export const PlataformaTenantHeader = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const req = ctx.switchToHttp().getRequest<PlataformaHttpReq>();
    return req.plataformaTenantId;
  },
);
