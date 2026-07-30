import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { SessionService } from '../../auth/session/session.service';
import { DeviceService } from '../../auth/session/device.service';
import { parseDurationToSeconds } from '../../auth/session/session.util';
import { PrismaService } from '../../prisma/prisma.service';
import type { MobileRefreshPayload, MobileRole } from '../types/mobile-hub.types';
import { MobileDeviceBindingStore } from '../stores/mobile-device-binding.store';
import { MobileMotoristaIdentitiesStore } from '../stores/mobile-motorista-identities.store';
import { MobileJwtService } from './mobile-jwt.service';
import { normalizeLoginDocumento } from '../../common/utils/login-documento.util';

const OPERADOR_ROLES: Role[] = [
  Role.OPERADOR_PORTARIA,
  Role.OPERADOR_GATE,
  Role.OPERADOR_PATIO,
];

@Injectable()
export class MobileIdentityService {
  private readonly logger = new Logger(MobileIdentityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly motoristas: MobileMotoristaIdentitiesStore,
    private readonly devices: MobileDeviceBindingStore,
    private readonly mobileJwt: MobileJwtService,
    private readonly config: ConfigService,
    private readonly session: SessionService,
    private readonly device: DeviceService,
  ) {}

  private async registerMobileSession(
    principalId: string,
    req: Request | undefined,
    deviceId: string,
  ): Promise<{ sid?: string; fp?: string }> {
    if (!req) return {};
    try {
      const ip = String(req.ip || req.socket?.remoteAddress || '');
      const ua = req.get('user-agent') || '';
      const hdr = this.device.extractHeaders(req);
      const fp = this.device.computeFingerprint(ip, ua, hdr, deviceId);
      const ttl = parseDurationToSeconds(
        this.config.get<string>('MOBILE_JWT_REFRESH_EXPIRES_IN') ?? '30d',
      );
      const { sessionId } = await this.session.registerSession(
        principalId,
        { fingerprint: fp, ip, userAgent: ua, channel: 'mobile' },
        ttl,
      );
      return { sid: sessionId, fp };
    } catch (e) {
      this.logger.warn(`Redis sessão mobile: ${(e as Error).message}`);
      return {};
    }
  }

  private async validateMobileRefresh(
    principalId: string,
    pl: MobileRefreshPayload,
    req: Request | undefined,
  ): Promise<{ sid?: string; fp?: string }> {
    if (!pl.sid || pl.fp === undefined) return {};
    if (!req) {
      throw new UnauthorizedException('Contexto de dispositivo ausente para refresh');
    }
    const ip = String(req.ip || req.socket?.remoteAddress || '');
    const ua = req.get('user-agent') || '';
    const hdr = this.device.extractHeaders(req);
    const fpNow = this.device.computeFingerprint(ip, ua, hdr, pl.deviceId);
    if (fpNow !== pl.fp) {
      throw new UnauthorizedException('Fingerprint não coincide com a sessão mobile');
    }
    const ttl = parseDurationToSeconds(
      this.config.get<string>('MOBILE_JWT_REFRESH_EXPIRES_IN') ?? '30d',
    );
    const ok = await this.session.assertSessionValid(principalId, pl.sid, fpNow, ttl);
    if (!ok) throw new UnauthorizedException('Sessão mobile inválida ou expirada');
    return { sid: pl.sid, fp: fpNow };
  }

  async login(
    documentoRaw: string,
    password: string,
    deviceId: string,
    mobileRole: MobileRole,
    req?: Request,
  ) {
    const dev = deviceId.trim();
    if (dev.length < 4) throw new BadRequestException('deviceId inválido');

    if (mobileRole === 'OPERADOR_MOBILE') {
      const cpfCnpj = normalizeLoginDocumento(documentoRaw);
      const user = await this.prisma.user.findFirst({ where: { cpfCnpj } });
      if (!user || !OPERADOR_ROLES.includes(user.role)) {
        throw new UnauthorizedException('Credenciais inválidas para operador mobile');
      }
      const ok = await bcrypt.compare(password, user.password);
      if (!ok) throw new UnauthorizedException('Credenciais inválidas para operador mobile');
      await this.devices.registrar(user.id, dev);
      const sess = await this.registerMobileSession(user.id, req, dev);
      const access = this.mobileJwt.signAccess({
        sub: user.id,
        email: user.email,
        cpfCnpj: user.cpfCnpj,
        mobileRole: 'OPERADOR_MOBILE',
        deviceId: dev,
        tv: user.tokenVersion,
        clienteId: user.clienteId ?? null,
        ...(sess.sid ? { sid: sess.sid } : {}),
      });
      const refresh = this.mobileJwt.signRefresh({
        sub: user.id,
        tv: user.tokenVersion,
        mobileRole: 'OPERADOR_MOBILE',
        deviceId: dev,
        ...(sess.sid && sess.fp ? { sid: sess.sid, fp: sess.fp } : {}),
      });
      return { accessToken: access, refreshToken: refresh, tokenType: 'Bearer', mobileApiVersion: 'v1' };
    }

    if (mobileRole === 'CLIENTE_APP') {
      const cpfCnpj = normalizeLoginDocumento(documentoRaw);
      const user = await this.prisma.user.findFirst({ where: { cpfCnpj } });
      if (!user || user.role !== Role.CLIENTE) {
        throw new UnauthorizedException('Credenciais inválidas para app cliente');
      }
      const ok = await bcrypt.compare(password, user.password);
      if (!ok) throw new UnauthorizedException('Credenciais inválidas para app cliente');
      await this.devices.registrar(user.id, dev);
      const sess = await this.registerMobileSession(user.id, req, dev);
      const access = this.mobileJwt.signAccess({
        sub: user.id,
        email: user.email,
        cpfCnpj: user.cpfCnpj,
        mobileRole: 'CLIENTE_APP',
        deviceId: dev,
        tv: user.tokenVersion,
        clienteId: user.clienteId ?? null,
        ...(sess.sid ? { sid: sess.sid } : {}),
      });
      const refresh = this.mobileJwt.signRefresh({
        sub: user.id,
        tv: user.tokenVersion,
        mobileRole: 'CLIENTE_APP',
        deviceId: dev,
        ...(sess.sid && sess.fp ? { sid: sess.sid, fp: sess.fp } : {}),
      });
      return { accessToken: access, refreshToken: refresh, tokenType: 'Bearer', mobileApiVersion: 'v1' };
    }

    const m = await this.motoristas.validar(documentoRaw, password);
    if (!m) throw new UnauthorizedException('Credenciais inválidas para motorista');
    await this.devices.registrar(m.id, dev);
    const sess = await this.registerMobileSession(m.id, req, dev);
    const access = this.mobileJwt.signAccess({
      sub: m.id,
      email: m.email,
      cpfCnpj: m.cpfCnpj,
      mobileRole: 'MOTORISTA',
      deviceId: dev,
      tv: m.tokenVersion,
      protocoloContexto: m.protocoloPadrao,
      clienteId: null,
      ...(sess.sid ? { sid: sess.sid } : {}),
    });
    const refresh = this.mobileJwt.signRefresh({
      sub: m.id,
      tv: m.tokenVersion,
      mobileRole: 'MOTORISTA',
      deviceId: dev,
      ...(sess.sid && sess.fp ? { sid: sess.sid, fp: sess.fp } : {}),
    });
    return { accessToken: access, refreshToken: refresh, tokenType: 'Bearer', mobileApiVersion: 'v1' };
  }

  async refresh(refreshToken: string, req?: Request) {
    let pl: MobileRefreshPayload;
    try {
      pl = this.mobileJwt.verifyRefresh(refreshToken);
    } catch {
      throw new UnauthorizedException('Refresh mobile inválido');
    }
    if (pl.mobileRole === 'MOTORISTA') {
      const m = await this.motoristas.obterPorId(pl.sub);
      if (!m || m.tokenVersion !== pl.tv) throw new UnauthorizedException('Sessão revogada');
      if (!(await this.devices.dispositivoLiberado(pl.deviceId, pl.sub))) {
        throw new UnauthorizedException('Dispositivo não vinculado');
      }
      const vr = await this.validateMobileRefresh(m.id, pl, req);
      const access = this.mobileJwt.signAccess({
        sub: m.id,
        email: m.email,
        cpfCnpj: m.cpfCnpj,
        mobileRole: 'MOTORISTA',
        deviceId: pl.deviceId,
        tv: m.tokenVersion,
        protocoloContexto: m.protocoloPadrao,
        clienteId: null,
        ...(vr.sid ? { sid: vr.sid } : {}),
      });
      const next = this.mobileJwt.signRefresh({
        sub: m.id,
        tv: m.tokenVersion,
        mobileRole: 'MOTORISTA',
        deviceId: pl.deviceId,
        ...(vr.sid && vr.fp ? { sid: vr.sid, fp: vr.fp } : {}),
      });
      return { accessToken: access, refreshToken: next, tokenType: 'Bearer' };
    }

    const user = await this.prisma.user.findUnique({ where: { id: pl.sub } });
    if (!user || user.tokenVersion !== pl.tv) throw new UnauthorizedException('Sessão revogada');
    if (!(await this.devices.dispositivoLiberado(pl.deviceId, user.id))) {
      throw new UnauthorizedException('Dispositivo não vinculado');
    }
    const vr = await this.validateMobileRefresh(user.id, pl, req);
    const role: MobileRole =
      user.role === Role.CLIENTE ? 'CLIENTE_APP' : 'OPERADOR_MOBILE';
    const access = this.mobileJwt.signAccess({
      sub: user.id,
      email: user.email,
      cpfCnpj: user.cpfCnpj,
      mobileRole: role,
      deviceId: pl.deviceId,
      tv: user.tokenVersion,
      clienteId: user.clienteId ?? null,
      ...(vr.sid ? { sid: vr.sid } : {}),
    });
    const next = this.mobileJwt.signRefresh({
      sub: user.id,
      tv: user.tokenVersion,
      mobileRole: role,
      deviceId: pl.deviceId,
      ...(vr.sid && vr.fp ? { sid: vr.sid, fp: vr.fp } : {}),
    });
    return { accessToken: access, refreshToken: next, tokenType: 'Bearer' };
  }
}
