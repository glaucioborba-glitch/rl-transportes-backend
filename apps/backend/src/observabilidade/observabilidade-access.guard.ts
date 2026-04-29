import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { OBS_ALERTAS_ADMIN_KEY } from './observabilidade-metadata';

/** ADMIN e GERENTE para leitura; POST alertas apenas ADMIN (via metadata). OPERADOR/CLIENTE 403. */
@Injectable()
export class ObservabilidadeAccessGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = req.user;
    if (!user) return false;

    const alertasAdminOnly =
      this.reflector.getAllAndOverride<boolean>(OBS_ALERTAS_ADMIN_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false;

    if (alertasAdminOnly) {
      if (user.role !== Role.ADMIN) {
        throw new ForbiddenException('POST alertas requer papel ADMIN.');
      }
      return true;
    }

    if (user.role === Role.ADMIN || user.role === Role.GERENTE) return true;
    throw new ForbiddenException();
  }
}
