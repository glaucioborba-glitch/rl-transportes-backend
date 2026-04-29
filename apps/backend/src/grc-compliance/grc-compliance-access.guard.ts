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
import { GRC_ADMIN_ONLY_KEY } from './grc-compliance-metadata';

@Injectable()
export class GrcComplianceAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user: AuthUser }>();
    const user = req.user;
    const adminOnly =
      this.reflector.getAllAndOverride<boolean>(GRC_ADMIN_ONLY_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false;

    const privilegiado = user.role === Role.ADMIN || user.role === Role.GERENTE;
    if (privilegiado) return true;

    if (adminOnly) {
      throw new ForbiddenException('Requer papel ADMIN ou GERENTE.');
    }

    const lista = (this.config.get<string>('GRC_SUPERVISOR_EMAILS') ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const email = user.email?.toLowerCase() ?? '';
    if (email && lista.includes(email)) return true;

    throw new ForbiddenException();
  }
}
