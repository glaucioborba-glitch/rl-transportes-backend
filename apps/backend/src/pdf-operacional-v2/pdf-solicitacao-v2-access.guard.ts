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
import type { CxPortalRequestUser, PortalAccessTokenPayload } from '../cx-portais/types/cx-portal.types';
import { SessionService } from '../auth/session/session.service';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { AUTH_ACCESS_COOKIE } from '../auth/auth-cookie.constants';
import { extractPortalAccessToken } from '../cx-portais/identity/portal-cookie.util';
import { isTransportadoraTerceiraRole } from '../common/constants/portal-tenant-roles.util';
import { TRANSPORTADORA_PERMISSOES_FIXAS } from '../common/constants/transportadora-permissoes.constants';
import { PdfOperacionalV2Service } from './pdf-operacional-v2.service';

type PdfRequest = Request & { pdfAccess?: string; cxUser?: CxPortalRequestUser };

function extractAccessToken(req: Request): string | null {
  const portalTok = extractPortalAccessToken({
    headers: req.headers,
    cookies: (req as Request & { cookies?: Record<string, string> }).cookies,
  });
  if (portalTok?.trim()) return portalTok.trim();

  const raw = (req.headers.authorization ?? '').trim();
  const bearer = /^Bearer\s+(.+)$/i.exec(raw);
  if (bearer?.[1]?.trim()) return bearer[1].trim();

  if (process.env.AUTH_HTTP_ONLY_COOKIES === '1') {
    const cookie = (req as Request & { cookies?: Record<string, string> }).cookies?.[
      AUTH_ACCESS_COOKIE
    ];
    if (cookie?.trim()) return cookie.trim();
  }

  return null;
}

/** Portal (CLIENTE dono) ou staff com papéis operacionais. */
@Injectable()
export class PdfSolicitacaoV2AccessGuard implements CanActivate {
  constructor(
    private readonly portalJwt: PortalJwtService,
    private readonly prisma: PrismaService,
    private readonly sessionService: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<PdfRequest>();
    const solicitacaoId = req.params['id'];
    if (!solicitacaoId) throw new ForbiddenException();

    const token = extractAccessToken(req);
    if (!token) throw new UnauthorizedException('Bearer obrigatório');

    try {
      const pl = this.portalJwt.verifyAccess(token) as PortalAccessTokenPayload;
      if (pl.kind === 'portal' && pl.portalPapel === 'CLIENTE') {
        assertPortalClienteTokenPayload(pl);
        const user = await this.prisma.user.findUnique({
          where: { id: pl.sub },
          include: { transportadoraAutorizada: true },
        });
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
        req.pdfAccess = 'portal';
        req.cxUser = {
          sub: user.id,
          email: user.email,
          cpfCnpj: user.cpfCnpj,
          portalPapel: 'CLIENTE',
          portalTenantRole: user.role,
          tenantId: user.tenantId || pl.tenantId || 'default',
          clienteId,
          tokenVersion: user.tokenVersion,
          auth: 'portal',
          sid: pl.sid,
          transportadoraId: user.transportadoraAutorizada?.id ?? null,
        };
        await this.hydratePessoaAutorizada(req);
        if (isTransportadoraTerceiraRole(user.role) && user.transportadoraAutorizada) {
          const ta = user.transportadoraAutorizada;
          req.cxUser.permissoesPessoa = TRANSPORTADORA_PERMISSOES_FIXAS;
          req.cxUser.pessoaAutorizada = {
            id: ta.id,
            nome: ta.razaoSocial,
            email: ta.emailContato,
            telefone: null,
          };
        }
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
    const tenantId = user.tenantId || payload.tenantId || 'default';
    const sol = await this.prisma.solicitacao.findFirst({
      where: {
        id: solicitacaoId,
        tenantId,
        deletedAt: null,
        transporteSolicitacao: { isNot: null },
      },
    });
    if (!sol) throw new NotFoundException('Solicitação v2 não encontrada');
    req.pdfAccess = 'staff';
    req.cxUser = {
      sub: user.id,
      email: user.email,
      cpfCnpj: user.cpfCnpj,
      portalPapel: 'STAFF',
      staffRole: user.role,
      tenantId: user.tenantId || payload.tenantId || 'default',
      clienteId: null,
      tokenVersion: user.tokenVersion,
      auth: 'staff',
      sid: payload.sid,
    };
    return true;
  }

  private async hydratePessoaAutorizada(req: PdfRequest): Promise<void> {
    const cx = req.cxUser;
    if (!cx?.sid?.trim() || cx.portalPapel !== 'CLIENTE') return;
    try {
      const sess = await this.sessionService.getSession(cx.sub, cx.sid);
      if (sess?.pessoaAutorizada) cx.pessoaAutorizada = sess.pessoaAutorizada;
      if (sess?.permissoesPessoa) cx.permissoesPessoa = sess.permissoesPessoa;
    } catch {
      /* sessão opcional */
    }
  }
}
