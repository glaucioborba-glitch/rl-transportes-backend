import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import type { AuthUser } from '../decorators/current-user.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const { user } = context.switchToHttp().getRequest<{ user: AuthUser }>();
    if (!user) throw new ForbiddenException('Usuário não autenticado');

    if (user.role === Role.ADMIN) return true;

    const perms = user.permissions ?? [];
    const ok = required.every((p) => perms.includes(p));
    if (!ok) {
      throw new ForbiddenException('Permissão insuficiente para esta operação');
    }
    return true;
  }
}
