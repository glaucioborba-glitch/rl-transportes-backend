import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { MOBILE_ROLES_KEY } from './mobile-roles.decorator';
import type { MobileRole, MobileRequestUser } from '../types/mobile-hub.types';

@Injectable()
export class MobileRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowed = this.reflector.getAllAndOverride<MobileRole[] | undefined>(MOBILE_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!allowed?.length) return true;
    const req = context.switchToHttp().getRequest<Request & { mobileUser?: MobileRequestUser }>();
    const u = req.mobileUser;
    if (!u) throw new ForbiddenException('Mobile: sem usuário');
    if (!allowed.includes(u.mobileRole)) throw new ForbiddenException('Mobile: papel não autorizado');
    return true;
  }
}
