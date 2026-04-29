import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { CX_PORTAL_SEGMENT, CX_PORTAL_STAFF_ONLY, type CxPortalSegmentValue } from '../decorators/cx-portal.decorators';
import type { CxPortalRequestUser } from '../types/cx-portal.types';

@Injectable()
export class CxPortalSegmentGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const seg = this.reflector.getAllAndOverride<CxPortalSegmentValue | undefined>(CX_PORTAL_SEGMENT, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!seg) return true;

    const req = context.switchToHttp().getRequest<Request & { cxUser?: CxPortalRequestUser }>();
    const u = req.cxUser;
    if (!u) throw new ForbiddenException('CX: contexto ausente');

    if (u.portalPapel === 'STAFF') return true;

    if (seg === 'cliente' && u.portalPapel !== 'CLIENTE') {
      throw new ForbiddenException('Rota exclusiva do portal cliente');
    }
    if (seg === 'fornecedor' && u.portalPapel !== 'FORNECEDOR' && u.portalPapel !== 'PARCEIRO') {
      throw new ForbiddenException('Rota exclusiva do portal fornecedor/parceiro');
    }
    return true;
  }
}

@Injectable()
export class CxPortalStaffOnlyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const staffOnly = this.reflector.getAllAndOverride<boolean>(CX_PORTAL_STAFF_ONLY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!staffOnly) return true;

    const req = context.switchToHttp().getRequest<Request & { cxUser?: CxPortalRequestUser }>();
    const u = req.cxUser;
    if (!u || u.portalPapel !== 'STAFF') {
      throw new ForbiddenException('Recurso restrito a ADMIN/GERENTE (JWT corporativo).');
    }
    return true;
  }
}
