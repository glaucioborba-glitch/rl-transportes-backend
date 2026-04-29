import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { RH_PERF_ADMIN_ONLY_KEY } from './rh-performance-metadata';

@Injectable()
export class RhPerformanceAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user: AuthUser }>();
    const user = req.user;
    const adminOnly =
      this.reflector.getAllAndOverride<boolean>(RH_PERF_ADMIN_ONLY_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false;

    const privilegiado = user.role === Role.ADMIN || user.role === Role.GERENTE;
    if (privilegiado) return true;

    if (adminOnly) {
      throw new ForbiddenException('Requer papel ADMIN ou GERENTE.');
    }

    const lista = (this.config.get<string>('RH_PERF_SUPERVISOR_EMAILS') ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const email = user.email?.toLowerCase() ?? '';
    if (email && lista.includes(email)) return true;

    throw new ForbiddenException();
  }
}
