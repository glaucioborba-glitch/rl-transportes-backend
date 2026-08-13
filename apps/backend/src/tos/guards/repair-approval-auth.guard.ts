import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';
import { permissionsForRole } from '../../common/constants/role-permissions';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CxPortalAuthGuard } from '../../cx-portais/guards/cx-portal-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionService } from '../../auth/session/session.service';

export type RepairApprovalActor = {
  userId: string;
  origem: 'CLIENTE_PORTAL' | 'STAFF_INTRANET';
  clienteId?: string;
};

function extractBearer(req: Request): string | null {
  const raw = (req.headers.authorization ?? '').trim();
  const m = /^Bearer\s+(.+)$/i.exec(raw);
  return m?.[1]?.trim() ?? null;
}

/**
 * Aceita JWT do Portal (cliente) ou JWT da Intranet (staff) para aprovação dual de reparos.
 */
@Injectable()
export class RepairApprovalAuthGuard implements CanActivate {
  constructor(
    private readonly portalGuard: CxPortalAuthGuard,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly session: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & { repairApprovalActor?: RepairApprovalActor; cxUser?: unknown; user?: AuthUser }
    >();

    try {
      const portalOk = await this.portalGuard.canActivate(context);
      if (portalOk && req.cxUser) {
        const cx = req.cxUser as { sub: string; clienteId?: string | null };
        req.repairApprovalActor = {
          userId: cx.sub,
          origem: 'CLIENTE_PORTAL',
          clienteId: cx.clienteId ?? undefined,
        };
        return true;
      }
    } catch {
      // fallback staff
    }

    const token = extractBearer(req);
    if (!token) {
      throw new UnauthorizedException('Bearer obrigatório (portal ou intranet).');
    }

    const secret =
      this.config.get<string>('secrets.jwtSecret') ??
      this.config.getOrThrow<string>('JWT_SECRET');

    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(token, { secret });
    } catch {
      throw new UnauthorizedException('Token inválido para aprovação de reparo.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.tokenVersion !== (payload.tv ?? 0)) {
      throw new UnauthorizedException('Sessão staff inválida.');
    }

    if (payload.fp && (await this.session.isFingerprintBlocked(payload.fp))) {
      throw new UnauthorizedException('Sessão bloqueada.');
    }

    const staffRoles: Role[] = [
      Role.ADMIN,
      Role.GERENTE,
      Role.OPERADOR_GATE,
      Role.OPERADOR_PATIO,
      Role.OPERADOR_PORTARIA,
    ];
    if (!staffRoles.includes(user.role)) {
      throw new UnauthorizedException('Papel sem permissão para aprovar reparo via intranet.');
    }

    req.user = {
      sub: user.id,
      id: user.id,
      email: user.email,
      cpfCnpj: user.cpfCnpj,
      role: user.role,
      permissions: [...permissionsForRole(user.role)],
      clienteId: user.clienteId,
    };

    req.repairApprovalActor = {
      userId: user.id,
      origem: 'STAFF_INTRANET',
      clienteId: user.clienteId ?? undefined,
    };

    return true;
  }
}
