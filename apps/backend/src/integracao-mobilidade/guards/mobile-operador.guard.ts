import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { AuthUser } from '../../common/decorators/current-user.decorator';

const MOBILE_ROLES: Role[] = [
  Role.OPERADOR_PORTARIA,
  Role.OPERADOR_GATE,
  Role.OPERADOR_PATIO,
];

/** Somente operadores de campo (JWT). Usar após `AuthGuard('jwt')`. */
@Injectable()
export class MobileOperadorGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const role = req.user?.role;
    if (!role || !MOBILE_ROLES.includes(role)) {
      throw new ForbiddenException('Somente operadores (portaria/gate/pátio).');
    }
    return true;
  }
}
