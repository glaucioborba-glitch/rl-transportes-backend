import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import type { PortalPapel } from '../types/cx-portal.types';
import { PortalFornecedorIdentitiesStore } from '../stores/portal-fornecedor-identities.store';
import { PortalJwtService } from './portal-jwt.service';

@Injectable()
export class PortalIdentityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fornecedores: PortalFornecedorIdentitiesStore,
    private readonly portalJwt: PortalJwtService,
  ) {}

  async login(email: string, password: string, papel?: PortalPapel, tenantIdGuess?: string) {
    const p = (papel ?? 'CLIENTE') as PortalPapel;
    if (p === 'CLIENTE') {
      const user = await this.prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });
      if (!user || user.role !== Role.CLIENTE) {
        throw new UnauthorizedException('Credenciais inválidas para portal cliente');
      }
      const ok = await bcrypt.compare(password, user.password);
      if (!ok) throw new UnauthorizedException('Credenciais inválidas para portal cliente');

      const tenantId = tenantIdGuess ?? 'default';
      const access = this.portalJwt.signAccess({
        sub: user.id,
        email: user.email,
        portalPapel: 'CLIENTE',
        tenantId,
        clienteId: user.clienteId ?? null,
        tv: user.tokenVersion,
      });
      const refresh = this.portalJwt.signRefresh({
        sub: user.id,
        tv: user.tokenVersion,
        portalPapel: 'CLIENTE',
        tenantId,
        clienteId: user.clienteId ?? null,
      });
      return { accessToken: access, refreshToken: refresh, tokenType: 'Bearer', portalPapel: 'CLIENTE', tenantId };
    }

    const f = await this.fornecedores.validarSenha(email, password);
    if (!f) {
      throw new UnauthorizedException('Credenciais inválidas para portal fornecedor');
    }
    if (p !== 'FORNECEDOR' && p !== 'PARCEIRO') {
      throw new UnauthorizedException('Informe papel FORNECEDOR ou PARCEIRO');
    }
    if (f.papel !== p) {
      throw new UnauthorizedException('Papel não coincide com o cadastro CX');
    }

    const access = this.portalJwt.signAccess({
      sub: f.id,
      email: f.email,
      portalPapel: f.papel,
      tenantId: f.tenantId,
      clienteId: null,
      tv: f.tokenVersion,
    });
    const refresh = this.portalJwt.signRefresh({
      sub: f.id,
      tv: f.tokenVersion,
      portalPapel: f.papel,
      tenantId: f.tenantId,
      clienteId: null,
    });
    return { accessToken: access, refreshToken: refresh, tokenType: 'Bearer', portalPapel: f.papel, tenantId: f.tenantId };
  }

  async refresh(refreshToken: string) {
    let payload;
    try {
      payload = this.portalJwt.verifyRefresh(refreshToken);
    } catch {
      throw new UnauthorizedException('Refresh portal inválido');
    }
    if (payload.portalPapel === 'CLIENTE') {
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || user.tokenVersion !== payload.tv) {
        throw new UnauthorizedException('Sessão portal revogada');
      }
      const access = this.portalJwt.signAccess({
        sub: user.id,
        email: user.email,
        portalPapel: 'CLIENTE',
        tenantId: payload.tenantId,
        clienteId: user.clienteId ?? null,
        tv: user.tokenVersion,
      });
      const nextRefresh = this.portalJwt.signRefresh({
        sub: user.id,
        tv: user.tokenVersion,
        portalPapel: 'CLIENTE',
        tenantId: payload.tenantId,
        clienteId: user.clienteId ?? null,
      });
      return { accessToken: access, refreshToken: nextRefresh, tokenType: 'Bearer' };
    }

    const f = this.fornecedores.obterPorId(payload.sub);
    if (!f || f.tokenVersion !== payload.tv) {
      throw new UnauthorizedException('Sessão portal revogada');
    }
    const access = this.portalJwt.signAccess({
      sub: f.id,
      email: f.email,
      portalPapel: f.papel,
      tenantId: f.tenantId,
      clienteId: null,
      tv: f.tokenVersion,
    });
    const nextRefresh = this.portalJwt.signRefresh({
      sub: f.id,
      tv: f.tokenVersion,
      portalPapel: f.papel,
      tenantId: f.tenantId,
      clienteId: null,
    });
    return { accessToken: access, refreshToken: nextRefresh, tokenType: 'Bearer' };
  }

  twoFaStub(body: { code?: string }) {
    if (body.code === '000000') {
      throw new ConflictException('Código 2FA inválido (simulado)');
    }
    return {
      enabled: false,
      message: '2FA opcional — não habilitado nesta fase.',
    };
  }
}
