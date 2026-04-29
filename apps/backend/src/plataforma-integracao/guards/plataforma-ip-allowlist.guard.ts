import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Allowlist opcional `PLATAFORMA_GATEWAY_IP_ALLOWLIST` para rotas públicas / gateway. */
@Injectable()
export class PlataformaIpAllowlistGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const raw = this.config.get<string>('PLATAFORMA_GATEWAY_IP_ALLOWLIST')?.trim();
    if (!raw) return true;
    const req = context.switchToHttp().getRequest<{
      ip?: string;
      socket?: { remoteAddress?: string };
      headers: Record<string, string | string[] | undefined>;
    }>();
    const fwd = req.headers['x-forwarded-for'];
    const firstFwd = typeof fwd === 'string' ? fwd.split(',')[0]?.trim() : '';
    const ip = firstFwd || req.ip || req.socket?.remoteAddress || '';
    const allowed = raw.split(',').map((s) => s.trim()).filter(Boolean);
    if (ip && allowed.includes(ip)) return true;
    throw new ForbiddenException({
      success: false,
      error: { code: 'IP_BLOCKED', message: 'IP não autorizado no gateway corporativo.' },
    });
  }
}
