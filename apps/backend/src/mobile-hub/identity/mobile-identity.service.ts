import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import type { MobileRole } from '../types/mobile-hub.types';
import { MobileDeviceBindingStore } from '../stores/mobile-device-binding.store';
import { MobileMotoristaIdentitiesStore } from '../stores/mobile-motorista-identities.store';
import { MobileJwtService } from './mobile-jwt.service';

const OPERADOR_ROLES: Role[] = [
  Role.OPERADOR_PORTARIA,
  Role.OPERADOR_GATE,
  Role.OPERADOR_PATIO,
];

@Injectable()
export class MobileIdentityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly motoristas: MobileMotoristaIdentitiesStore,
    private readonly devices: MobileDeviceBindingStore,
    private readonly mobileJwt: MobileJwtService,
  ) {}

  async login(
    email: string,
    password: string,
    deviceId: string,
    mobileRole: MobileRole,
  ) {
    const dev = deviceId.trim();
    if (dev.length < 4) throw new BadRequestException('deviceId inválido');

    if (mobileRole === 'OPERADOR_MOBILE') {
      const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      if (!user || !OPERADOR_ROLES.includes(user.role)) {
        throw new UnauthorizedException('Credenciais inválidas para operador mobile');
      }
      const ok = await bcrypt.compare(password, user.password);
      if (!ok) throw new UnauthorizedException('Credenciais inválidas para operador mobile');
      this.devices.registrar(user.id, dev);
      const access = this.mobileJwt.signAccess({
        sub: user.id,
        email: user.email,
        mobileRole: 'OPERADOR_MOBILE',
        deviceId: dev,
        tv: user.tokenVersion,
        clienteId: user.clienteId ?? null,
      });
      const refresh = this.mobileJwt.signRefresh({
        sub: user.id,
        tv: user.tokenVersion,
        mobileRole: 'OPERADOR_MOBILE',
        deviceId: dev,
      });
      return { accessToken: access, refreshToken: refresh, tokenType: 'Bearer', mobileApiVersion: 'v1' };
    }

    if (mobileRole === 'CLIENTE_APP') {
      const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      if (!user || user.role !== Role.CLIENTE) {
        throw new UnauthorizedException('Credenciais inválidas para app cliente');
      }
      const ok = await bcrypt.compare(password, user.password);
      if (!ok) throw new UnauthorizedException('Credenciais inválidas para app cliente');
      this.devices.registrar(user.id, dev);
      const access = this.mobileJwt.signAccess({
        sub: user.id,
        email: user.email,
        mobileRole: 'CLIENTE_APP',
        deviceId: dev,
        tv: user.tokenVersion,
        clienteId: user.clienteId ?? null,
      });
      const refresh = this.mobileJwt.signRefresh({
        sub: user.id,
        tv: user.tokenVersion,
        mobileRole: 'CLIENTE_APP',
        deviceId: dev,
      });
      return { accessToken: access, refreshToken: refresh, tokenType: 'Bearer', mobileApiVersion: 'v1' };
    }

    const m = await this.motoristas.validar(email, password);
    if (!m) throw new UnauthorizedException('Credenciais inválidas para motorista');
    this.devices.registrar(m.id, dev);
    const access = this.mobileJwt.signAccess({
      sub: m.id,
      email: m.email,
      mobileRole: 'MOTORISTA',
      deviceId: dev,
      tv: m.tokenVersion,
      protocoloContexto: m.protocoloPadrao,
      clienteId: null,
    });
    const refresh = this.mobileJwt.signRefresh({
      sub: m.id,
      tv: m.tokenVersion,
      mobileRole: 'MOTORISTA',
      deviceId: dev,
    });
    return { accessToken: access, refreshToken: refresh, tokenType: 'Bearer', mobileApiVersion: 'v1' };
  }

  async refresh(refreshToken: string) {
    let pl;
    try {
      pl = this.mobileJwt.verifyRefresh(refreshToken);
    } catch {
      throw new UnauthorizedException('Refresh mobile inválido');
    }
    if (pl.mobileRole === 'MOTORISTA') {
      const m = this.motoristas.obterPorId(pl.sub);
      if (!m || m.tokenVersion !== pl.tv) throw new UnauthorizedException('Sessão revogada');
      if (!this.devices.dispositivoLiberado(pl.deviceId, pl.sub)) {
        throw new UnauthorizedException('Dispositivo não vinculado');
      }
      const access = this.mobileJwt.signAccess({
        sub: m.id,
        email: m.email,
        mobileRole: 'MOTORISTA',
        deviceId: pl.deviceId,
        tv: m.tokenVersion,
        protocoloContexto: m.protocoloPadrao,
        clienteId: null,
      });
      const next = this.mobileJwt.signRefresh({
        sub: m.id,
        tv: m.tokenVersion,
        mobileRole: 'MOTORISTA',
        deviceId: pl.deviceId,
      });
      return { accessToken: access, refreshToken: next, tokenType: 'Bearer' };
    }

    const user = await this.prisma.user.findUnique({ where: { id: pl.sub } });
    if (!user || user.tokenVersion !== pl.tv) throw new UnauthorizedException('Sessão revogada');
    if (!this.devices.dispositivoLiberado(pl.deviceId, user.id)) {
      throw new UnauthorizedException('Dispositivo não vinculado');
    }
    const role: MobileRole =
      user.role === Role.CLIENTE ? 'CLIENTE_APP' : 'OPERADOR_MOBILE';
    const access = this.mobileJwt.signAccess({
      sub: user.id,
      email: user.email,
      mobileRole: role,
      deviceId: pl.deviceId,
      tv: user.tokenVersion,
      clienteId: user.clienteId ?? null,
    });
    const next = this.mobileJwt.signRefresh({
      sub: user.id,
      tv: user.tokenVersion,
      mobileRole: role,
      deviceId: pl.deviceId,
    });
    return { accessToken: access, refreshToken: next, tokenType: 'Bearer' };
  }
}
