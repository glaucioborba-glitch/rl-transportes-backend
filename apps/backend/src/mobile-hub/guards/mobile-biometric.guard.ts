import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { MOBILE_CRITICAL_KEY } from './mobile-roles.decorator';
import { MobilePinLockoutStore } from '../stores/mobile-pin-lockout.store';

/** Rotas críticas: header `X-Mobile-Critical-Pin` deve coincidir com `MOBILE_CRITICAL_PIN` (env). */
@Injectable()
export class MobileBiometricGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
    private readonly lockout: MobilePinLockoutStore,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const critical = this.reflector.getAllAndOverride<boolean>(MOBILE_CRITICAL_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!critical) return true;

    const expected = this.config.get<string>('MOBILE_CRITICAL_PIN')?.trim();
    if (!expected) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const pin = (req.headers['x-mobile-critical-pin'] as string | undefined)?.trim();
    const sub = (req as Request & { mobileUser?: { sub: string } }).mobileUser?.sub ?? 'anon';
    const chave = `${sub}:${req.ip}`;

    if (this.lockout.bloqueado(chave)) {
      throw new ForbiddenException('Bloqueio por tentativas de PIN');
    }

    if (pin !== expected) {
      this.lockout.registrarFalha(chave);
      throw new ForbiddenException('PIN / biometria obrigatória para esta operação');
    }
    this.lockout.limpar(chave);
    return true;
  }
}
