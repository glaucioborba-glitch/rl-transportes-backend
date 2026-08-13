import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { CxPortalRequestUser } from '../types/cx-portal.types';

export const CurrentCxUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CxPortalRequestUser => {
    const req = ctx.switchToHttp().getRequest<Request & { cxUser?: CxPortalRequestUser }>();
    if (!req.cxUser) throw new UnauthorizedException('Sessão portal não autenticada');
    return req.cxUser;
  },
);
