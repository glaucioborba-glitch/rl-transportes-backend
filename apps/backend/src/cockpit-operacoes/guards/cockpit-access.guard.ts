import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import type { AuthUser } from '../../common/decorators/current-user.decorator';

const TURNO_PATHS = ['/cockpit/rh/turno', '/cockpit/rh/eficiencia', '/cockpit/indicadores/turno'];

/** RBAC NOC/TOC: ADMIN/GERENTE total; COCKPIT_SUPERVISOR_EMAILS estende OPERADOR_* ao cockpit completo; sem isso, operador só turno. */
@Injectable()
export class CockpitAccessGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user?: AuthUser; path?: string; url?: string }>();
    const user = req.user;
    if (!user) throw new ForbiddenException('Autenticação necessária');
    if (user.role === Role.CLIENTE) {
      throw new ForbiddenException('Cockpit indisponível para perfil cliente');
    }

    const path = (req as { path?: string }).path ?? (req.url?.split('?')[0] ?? '');
    const superLista = (this.config.get<string>('COCKPIT_SUPERVISOR_EMAILS') ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const email = user.email?.toLowerCase() ?? '';
    const supervisorOperador =
      superLista.includes(email) &&
      (user.role === Role.OPERADOR_PORTARIA ||
        user.role === Role.OPERADOR_GATE ||
        user.role === Role.OPERADOR_PATIO);

    const operador =
      user.role === Role.OPERADOR_PORTARIA ||
      user.role === Role.OPERADOR_GATE ||
      user.role === Role.OPERADOR_PATIO;

    if (path.startsWith('/cockpit/executivo')) {
      if (user.role !== Role.ADMIN && user.role !== Role.GERENTE) {
        throw new ForbiddenException('Painel executivo restrito a ADMIN ou GERENTE');
      }
      return true;
    }

    if (user.role === Role.ADMIN || user.role === Role.GERENTE) {
      return true;
    }

    if (supervisorOperador) {
      return true;
    }

    if (operador) {
      const okTur = TURNO_PATHS.some((p) => path === p || path.startsWith(p + '/'));
      if (!okTur) {
        throw new ForbiddenException('Operador: acesso apenas aos módulos de turno do cockpit');
      }
      return true;
    }

    throw new ForbiddenException('Papel não autorizado no cockpit');
  }
}
