import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { PortalFornecedorIdentitiesStore } from '../stores/portal-fornecedor-identities.store';
import { PortalJwtService } from '../identity/portal-jwt.service';
import { assertPortalClienteTokenPayload } from '../strategies/jwt-portal.strategy';
import type { CxPortalRequestUser } from '../types/cx-portal.types';
import { SessionService } from '../../auth/session/session.service';
import { extractPortalAccessToken } from '../identity/portal-cookie.util';
import {
  canPortalClienteLogin,
  isTransportadoraTerceiraRole,
} from '../../common/constants/portal-tenant-roles.util';
import { TRANSPORTADORA_PERMISSOES_FIXAS } from '../../common/constants/transportadora-permissoes.constants';

@Injectable()
export class CxPortalPublicApiForbidGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const hasPublic = !!(req.headers['x-public-api-key'] ?? req.headers['X-Public-Api-Key']);
    const auth = req.headers.authorization ?? '';
    if (hasPublic && !auth.startsWith('Bearer ')) {
      throw new ForbiddenException('Portais CX não aceitam apenas API Key pública. Use JWT portal.');
    }
    return true;
  }
}

@Injectable()
export class CxPortalAuthGuard implements CanActivate {
  constructor(
    private readonly portalJwt: PortalJwtService,
    private readonly prisma: PrismaService,
    private readonly fornecedores: PortalFornecedorIdentitiesStore,
    private readonly session: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { cxUser?: CxPortalRequestUser }>();
    const token = extractPortalAccessToken({
      headers: req.headers,
      cookies: (req as Request & { cookies?: Record<string, string> }).cookies,
    });
    if (!token?.trim()) {
      throw new UnauthorizedException('Bearer ou cookie portal obrigatório');
    }

    try {
      const pl = this.portalJwt.verifyAccess(token);
      if (pl.portalPapel === 'CLIENTE') {
        assertPortalClienteTokenPayload(pl);
        const user = await this.prisma.user.findUnique({
          where: { id: pl.sub },
          include: { transportadoraAutorizada: true },
        });
        if (!user || user.tokenVersion !== pl.tv) {
          throw new UnauthorizedException('Sessão portal inválida');
        }
        if (!canPortalClienteLogin(user.role)) {
          throw new UnauthorizedException('Perfil não autorizado no portal cliente.');
        }
        const clienteIdMerged = user.clienteId ?? pl.clienteId ?? null;
        if (!clienteIdMerged?.trim()) {
          throw new UnauthorizedException('Sessão portal sem vínculo de cliente (clienteId).');
        }
        if (!user.cpfCnpj?.replace(/\D/g, '').length) {
          throw new UnauthorizedException('Cadastro de usuário sem documento válido.');
        }
        req.cxUser = {
          sub: user.id,
          email: user.email,
          cpfCnpj: user.cpfCnpj,
          portalPapel: 'CLIENTE',
          portalTenantRole: user.role,
          tenantId: user.tenantId || pl.tenantId || 'default',
          clienteId: clienteIdMerged,
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
      const f = await this.fornecedores.obterPorId(pl.sub);
      if (!f || f.tokenVersion !== pl.tv || f.papel !== pl.portalPapel) {
        throw new UnauthorizedException('Sessão portal inválida');
      }
      req.cxUser = {
        sub: f.id,
        email: f.email,
        cpfCnpj: f.cpfCnpj,
        portalPapel: f.papel,
        tenantId: pl.tenantId,
        clienteId: null,
        tokenVersion: f.tokenVersion,
        auth: 'portal',
        sid: pl.sid,
      };
      return true;
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
    }

    let staffPayload: { sub: string; email: string; role: Role; tv?: number; sid?: string };
    try {
      staffPayload = this.portalJwt.verifyStaffAccess(token) as typeof staffPayload;
    } catch {
      throw new UnauthorizedException('Token inválido para portais CX');
    }

    const user = await this.prisma.user.findUnique({ where: { id: staffPayload.sub } });
    if (!user) throw new UnauthorizedException('Usuário não encontrado');
    if (user.tokenVersion !== (staffPayload.tv ?? 0)) {
      throw new UnauthorizedException('Sessão inválida');
    }
    if (user.role !== Role.ADMIN && user.role !== Role.GERENTE) {
      throw new ForbiddenException(
        'Portais CX: JWT portal (CLIENTE/FORNECEDOR) ou JWT corporativo de ADMIN/GERENTE.',
      );
    }

    const tenantId = user.tenantId || 'default';
    req.cxUser = {
      sub: user.id,
      email: user.email,
      cpfCnpj: user.cpfCnpj,
      portalPapel: 'STAFF',
      staffRole: user.role,
      tenantId,
      clienteId: null,
      tokenVersion: user.tokenVersion,
      auth: 'staff',
      sid: staffPayload.sid,
    };
    return true;
  }

  private async hydratePessoaAutorizada(
    req: Request & { cxUser?: CxPortalRequestUser },
  ): Promise<void> {
    const cx = req.cxUser;
    if (!cx?.sid?.trim() || cx.portalPapel !== 'CLIENTE') return;
    try {
      const sess = await this.session.getSession(cx.sub, cx.sid);
      if (sess?.pessoaAutorizada) {
        cx.pessoaAutorizada = sess.pessoaAutorizada;
      }
      if (sess?.permissoesPessoa) {
        cx.permissoesPessoa = sess.permissoesPessoa;
      }
    } catch {
      /* sessão opcional */
    }
  }
}
