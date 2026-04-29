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
import type { CxPortalRequestUser } from '../types/cx-portal.types';

@Injectable()
export class CxPortalPublicApiForbidGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const hasPublic = !!(req.headers['x-public-api-key'] ?? req.headers['X-Public-Api-Key']);
    const auth = req.headers.authorization ?? '';
    if (hasPublic && !auth.startsWith('Bearer ')) {
      throw new ForbiddenException('Portais CX não aceitam apenas API Key pública (Fase 18). Use JWT portal ou JWT staff.');
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
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { cxUser?: CxPortalRequestUser }>();
    const auth = req.headers.authorization ?? '';
    if (!auth.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bearer obrigatório');
    }
    const token = auth.slice(7).trim();

    try {
      const pl = this.portalJwt.verifyAccess(token);
      if (pl.portalPapel === 'CLIENTE') {
        const user = await this.prisma.user.findUnique({ where: { id: pl.sub } });
        if (!user || user.tokenVersion !== pl.tv) {
          throw new UnauthorizedException('Sessão portal inválida');
        }
        req.cxUser = {
          sub: user.id,
          email: user.email,
          portalPapel: 'CLIENTE',
          tenantId: pl.tenantId,
          clienteId: user.clienteId ?? null,
          tokenVersion: user.tokenVersion,
          auth: 'portal',
        };
        return true;
      }
      const f = this.fornecedores.obterPorId(pl.sub);
      if (!f || f.tokenVersion !== pl.tv || f.papel !== pl.portalPapel) {
        throw new UnauthorizedException('Sessão portal inválida');
      }
      req.cxUser = {
        sub: f.id,
        email: f.email,
        portalPapel: f.papel,
        tenantId: pl.tenantId,
        clienteId: null,
        tokenVersion: f.tokenVersion,
        auth: 'portal',
      };
      return true;
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
    }

    let staffPayload: { sub: string; email: string; role: Role; tv?: number };
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
      throw new ForbiddenException('Portais CX: somente CLIENTE/FORNECEDOR (JWT portal) ou ADMIN/GERENTE (JWT corporativo).');
    }

    const tenantId = (req.headers['x-tenant-id'] as string | undefined)?.trim() || 'default';
    req.cxUser = {
      sub: user.id,
      email: user.email,
      portalPapel: 'STAFF',
      staffRole: user.role,
      tenantId,
      clienteId: null,
      tokenVersion: user.tokenVersion,
      auth: 'staff',
    };
    return true;
  }
}
