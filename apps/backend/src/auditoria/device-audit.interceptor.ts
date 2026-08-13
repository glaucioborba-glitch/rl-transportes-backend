import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { SessionService } from '../auth/session/session.service';
import { parseDurationToSeconds } from '../auth/session/session.util';
import type { AuthChannel } from '../auth/session/session.types';
import { DeviceService } from '../auth/session/device.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import type { CxPortalRequestUser } from '../cx-portais/types/cx-portal.types';
import type { SecurityRequestContext } from '../common/types/security-request-context';

const GEO_CACHE_SEC = 1800;
const GEO_KEY_PREFIX = 'geo:ip:';

async function geoLookupRedis(
  redis: RedisService,
  ip: string,
): Promise<string | null> {
  const trimmed = ip.replace(/^::ffff:/, '').trim();
  if (
    !trimmed ||
    trimmed === '127.0.0.1' ||
    trimmed === '::1' ||
    trimmed.startsWith('10.') ||
    trimmed.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(trimmed)
  ) {
    return JSON.stringify({ scope: 'private' });
  }

  const cacheKey = `${GEO_KEY_PREFIX}${trimmed}`;
  const cached = await redis.get(cacheKey);
  if (cached) return cached;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 2500);
  try {
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(trimmed)}?fields=status,country,regionName,city,lat,lon,query`,
      { signal: ctrl.signal },
    );
    clearTimeout(t);
    if (!res.ok) return null;
    const j = (await res.json()) as Record<string, unknown>;
    if (j.status === 'fail') return null;
    const json = JSON.stringify({
      country: j.country,
      region: j.regionName,
      city: j.city,
      lat: j.lat,
      lon: j.lon,
    });
    await redis.setex(cacheKey, GEO_CACHE_SEC, json);
    return json;
  } catch {
    clearTimeout(t);
    return null;
  }
}

@Injectable()
export class DeviceAuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(DeviceAuditInterceptor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly device: DeviceService,
    private readonly redis: RedisService,
    private readonly session: SessionService,
    private readonly config: ConfigService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      finalize(() => {
        void this.persistSafe(context);
      }),
    );
  }

  private persistSafe(context: ExecutionContext): void {
    try {
      const req = context.switchToHttp().getRequest<
        Request & {
          user?: AuthUser;
          cxUser?: CxPortalRequestUser;
          securityContext?: SecurityRequestContext;
          deviceAuditLoggedByMiddleware?: boolean;
        }
      >();
      if (req.deviceAuditLoggedByMiddleware) return;
      const corp = req.user;
      const cx = req.cxUser;
      const userId = corp?.sub ?? corp?.id ?? cx?.sub;
      if (!userId) return;

      const ip = String(req.ip || req.socket?.remoteAddress || '');
      const ua = req.get('user-agent') || '';
      const hdr = this.device.extractHeaders(req);
      const secCtx = req.securityContext;
      const fp = secCtx?.fingerprint ?? this.device.computeFingerprint(ip, ua, hdr);
      const rota = (req as Request & { originalUrl?: string }).originalUrl || req.url || '';
      const metodo = req.method;
      const deviceType = this.device.deviceTypeFromUa(ua);
      const clienteId = (corp?.clienteId ?? cx?.clienteId ?? null) as string | null;
      const sessionForAudit =
        (corp?.sid ?? cx?.sid ?? secCtx?.sessionId ?? null) as string | null;
      const securityHeadersJson =
        secCtx?.device !== undefined
          ? ({
              os: secCtx.device.os,
              browser: secCtx.device.browser,
              screen: secCtx.device.screen,
              timezone: secCtx.device.timezone,
            } as Record<string, string>)
          : undefined;

      void this.saveRow({
        userId,
        clienteId,
        fingerprint: fp,
        ip,
        userAgent: ua.slice(0, 1000),
        rota: rota.slice(0, 500),
        metodo,
        deviceType,
        sessionId: sessionForAudit,
        securityHeaders: securityHeadersJson,
      });

      const sid = corp?.sid ?? cx?.sid;
      if (sid) {
        void this.touchSessionSafe(userId, sid);
      }
    } catch (e) {
      this.logger.warn(`device_audit persist: ${(e as Error).message}`);
    }
  }

  private async touchSessionSafe(userId: string, sessionId: string): Promise<void> {
    try {
      const cur = await this.session.getSession(userId, sessionId);
      if (!cur) return;
      const ch = cur.channel as AuthChannel;
      const ttlSec =
        ch === 'portal'
          ? parseDurationToSeconds(
              this.config.get<string>('PORTAL_JWT_REFRESH_EXPIRES_IN') ?? '7d',
            )
          : parseDurationToSeconds(
              this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d',
            );
      await this.session.touchSession(userId, sessionId, ttlSec);
    } catch (e) {
      this.logger.warn(`touchSession: ${(e as Error).message}`);
    }
  }

  private async saveRow(input: {
    userId: string;
    clienteId: string | null;
    fingerprint: string;
    ip: string;
    userAgent: string;
    rota: string;
    metodo: string;
    deviceType: string;
    sessionId?: string | null;
    securityHeaders?: Record<string, string>;
  }): Promise<void> {
    let geoloc: string | null = null;
    try {
      geoloc = await geoLookupRedis(this.redis, input.ip);
    } catch {
      geoloc = null;
    }
    try {
      await this.prisma.deviceAuditoria.create({
        data: {
          userId: input.userId,
          clienteId: input.clienteId,
          fingerprint: input.fingerprint,
          ip: input.ip.slice(0, 64),
          geoloc,
          userAgent: input.userAgent,
          rota: input.rota,
          metodo: input.metodo,
          deviceType: input.deviceType,
          sessionId: input.sessionId?.slice(0, 128) ?? null,
          securityHeaders: input.securityHeaders ?? undefined,
        },
      });
    } catch (e) {
      this.logger.warn(`device_auditoria: ${(e as Error).message}`);
    }
  }
}
