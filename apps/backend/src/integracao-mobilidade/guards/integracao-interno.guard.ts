import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/** Segredo compartilhado para POST interno `/integracao/eventos`. Header `X-Integracao-Interno`. */
@Injectable()
export class IntegracaoInternoGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const secret =
      process.env.INTEGRACAO_INTERNO_SECRET?.trim() ??
      this.config.get<string>('INTEGRACAO_INTERNO_SECRET')?.trim();
    if (!secret) throw new ForbiddenException('INTEGRACAO_INTERNO_SECRET não configurado.');
    const req = context.switchToHttp().getRequest<{ headers: Record<string, unknown> }>();
    const got = String(req.headers['x-integracao-interno'] ?? '').trim();
    const a = Buffer.from(secret, 'utf8');
    const b = Buffer.from(got, 'utf8');
    if (a.length !== b.length) throw new ForbiddenException();
    try {
      if (!crypto.timingSafeEqual(a, b)) throw new ForbiddenException();
    } catch {
      throw new ForbiddenException();
    }
    return true;
  }
}
