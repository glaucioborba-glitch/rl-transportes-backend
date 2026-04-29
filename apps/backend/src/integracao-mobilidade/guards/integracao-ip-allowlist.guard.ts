import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Se `INTEGRACAO_IP_ALLOWLIST` estiver definido (IPs vírgula), só esses IPs podem acessar a rota. */
@Injectable()
export class IntegracaoIpAllowlistGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const raw = this.config.get<string>('INTEGRACAO_IP_ALLOWLIST')?.trim();
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
    if (allowed.includes(ip)) return true;
    throw new ForbiddenException('IP não autorizado para integração.');
  }
}
