import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { isStaffJwtExemptPath } from '../http/staff-jwt-exempt-path.util';

/**
 * JWT staff por omissão. Controllers novos sem @UseGuards nascem autenticados.
 * Portal/mobile/webhooks usam @Public() ou prefixo com auth própria.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const path = req.path || req.url?.split('?')[0] || '';
    if (isStaffJwtExemptPath(path)) return true;

    return super.canActivate(context);
  }
}
