import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { Role } from '@prisma/client';
import { MobileMotoristaIdentitiesStore } from '../stores/mobile-motorista-identities.store';
import { MobileDeviceBindingStore } from '../stores/mobile-device-binding.store';
import { MobileJwtService } from '../identity/mobile-jwt.service';
import type { MobileRequestUser } from '../types/mobile-hub.types';

const BEARER = /^Bearer\s+(.+)$/i;

@Injectable()
export class MobileJwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: MobileJwtService,
    private readonly devices: MobileDeviceBindingStore,
    private readonly prisma: PrismaService,
    private readonly motoristas: MobileMotoristaIdentitiesStore,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { mobileUser?: MobileRequestUser }>();
    const h = req.headers.authorization ?? '';
    const m = BEARER.exec(h);
    if (!m) throw new UnauthorizedException('Bearer obrigatório (mobile)');
    let pl;
    try {
      pl = this.jwt.verifyAccess(m[1].trim());
    } catch {
      throw new UnauthorizedException('Token mobile inválido');
    }
    if (pl.kind !== 'mobile_access') throw new UnauthorizedException('Token não é mobile');
    if (!this.devices.dispositivoLiberado(pl.deviceId, pl.sub)) {
      throw new UnauthorizedException('Device não vinculado à sessão');
    }

    if (pl.mobileRole === 'MOTORISTA') {
      const mot = this.motoristas.obterPorId(pl.sub);
      if (!mot || mot.tokenVersion !== pl.tv) throw new UnauthorizedException('Sessão inválida');
      req.mobileUser = {
        sub: mot.id,
        email: mot.email,
        mobileRole: 'MOTORISTA',
        deviceId: pl.deviceId,
        tv: mot.tokenVersion,
        protocoloContexto: mot.protocoloPadrao,
        prismaUserId: undefined,
        clienteId: null,
      };
      return true;
    }

    const user = await this.prisma.user.findUnique({ where: { id: pl.sub } });
    if (!user || user.tokenVersion !== pl.tv) throw new UnauthorizedException('Sessão inválida');

    if (pl.mobileRole === 'OPERADOR_MOBILE') {
      if (
        user.role !== Role.OPERADOR_PORTARIA &&
        user.role !== Role.OPERADOR_GATE &&
        user.role !== Role.OPERADOR_PATIO
      ) {
        throw new UnauthorizedException('Papel Prisma incompatível com operador mobile');
      }
    } else if (pl.mobileRole === 'CLIENTE_APP') {
      if (user.role !== Role.CLIENTE) throw new UnauthorizedException('Papel Prisma incompatível com app cliente');
    }

    req.mobileUser = {
      sub: user.id,
      email: user.email,
      mobileRole: pl.mobileRole,
      deviceId: pl.deviceId,
      tv: user.tokenVersion,
      prismaUserId: user.id,
      clienteId: user.clienteId ?? null,
    };
    return true;
  }
}
