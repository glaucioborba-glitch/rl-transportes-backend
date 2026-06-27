import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { PortalJwtService } from '../cx-portais/identity/portal-jwt.service';
import { assertPortalClienteTokenPayload } from '../cx-portais/strategies/jwt-portal.strategy';
import type { PortalAccessTokenPayload } from '../cx-portais/types/cx-portal.types';
import { SessionService } from '../auth/session/session.service';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { PdfOperacionalV2Service } from './pdf-operacional-v2.service';

/** Portal (CLIENTE dono) ou staff com papéis operacionais. */
@Injectable()
export class PdfSolicitacaoV2AccessGuard implements CanActivate {
  constructor(
    private readonly portalJwt: PortalJwtService,
    private readonly prisma: PrismaService,
    private readonly sessionService: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const solicitacaoId = req.params['id'];
    if (!solicitacaoId) throw new ForbiddenException();

    const raw = (req.headers.authorization ?? '').trim();
    const m = /^Bearer\s+(.+)$/i.exec(raw);
    if (!m?.[1]?.trim()) throw new UnauthorizedException('Bearer obrigatório');
    const token = m[1].trim();

    try {
      const pl = this.portalJwt.verifyAccess(token) as PortalAccessTokenPayload;
      if (pl.kind === 'portal' && pl.portalPapel === 'CLIENTE') {
        assertPortalClienteTokenPayload(pl);
        const user = await this.prisma.user.findUnique({ where: { id: pl.sub } });
        if (!user || user.tokenVersion !== pl.tv) {
          throw new UnauthorizedException('Sessão portal inválida');
        }
        const clienteId = user.clienteId ?? pl.clienteId ?? null;
        if (!clienteId?.trim()) throw new UnauthorizedException('Cliente não vinculado');
        const sol = await this.prisma.solicitacao.findFirst({
          where: {
            id: solicitacaoId,
            clienteId,
            deletedAt: null,
            transporteSolicitacao: { isNot: null },
          },
        });
        if (!sol) throw new ForbiddenException('Acesso negado à solicitação');
        (req as Request & { pdfAccess?: string }).pdfAccess = 'portal';
        return true;
      }
    } catch (e) {
      if (e instanceof ForbiddenException || e instanceof UnauthorizedException) throw e;
    }

    let payload: JwtPayload;
    try {
      payload = this.portalJwt.verifyStaffAccess(token);
    } catch {
      throw new UnauthorizedException('Token inválido');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException('Usuário não encontrado');
    if (user.tokenVersion !== (payload.tv ?? 0)) {
      throw new UnauthorizedException('Sessão inválida');
    }
    if (payload.sid) {
      const s = await this.sessionService.getSession(payload.sub, payload.sid);
      if (!s) throw new UnauthorizedException('Sessão inválida');
    }
    const allowed = PdfOperacionalV2Service.staffRolesAllowed();
    if (!allowed.includes(payload.role)) {
      throw new ForbiddenException('Papel sem permissão para PDF operacional');
    }
    const sol = await this.prisma.solicitacao.findFirst({
      where: { id: solicitacaoId, deletedAt: null, transporteSolicitacao: { isNot: null } },
    });
    if (!sol) throw new NotFoundException('Solicitação v2 não encontrada');
    (req as Request & { pdfAccess?: string }).pdfAccess = 'staff';
    return true;
  }
}
