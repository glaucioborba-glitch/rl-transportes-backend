import type { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { AUTH_ACCESS_COOKIE, AUTH_REFRESH_COOKIE } from '../auth/auth-cookie.constants';
import {
  isSecurityHeadersExemptPath,
  shouldEnforceSecurityHeaders,
} from '../config/security.config';
import { PrismaService } from '../prisma/prisma.service';
import type { IntrusionService } from '../security-engine/intrusion.service';
import type { SecurityRequestContext } from '../common/types/security-request-context';

const HDR_SCREEN = 'x-device-screen';
const HDR_OS = 'x-device-os';
const HDR_BROWSER = 'x-device-browser';
const HDR_TZ = 'x-device-timezone';
const HDR_FP = 'x-device-fingerprint';
const HDR_SID = 'x-session-id';

const MSG_400 = 'Headers de segurança inválidos ou ausentes.';

const FINGERPRINT_MIN_LEN = 8;
const SESSION_ID_MAX = 128;

function pickHeader(req: Request, name: string): string | undefined {
  const v = req.headers[name.toLowerCase()];
  if (Array.isArray(v)) return v[0]?.trim();
  return typeof v === 'string' ? v.trim() : undefined;
}

function normalizeOsBrowser(value: string): string {
  return value.trim().toLowerCase().slice(0, 256);
}

function normalizeScreen(value: string): string {
  return value.trim().slice(0, 64);
}

function normalizeTimezone(value: string): string {
  return value.trim().toLowerCase().slice(0, 128);
}

function normalizeFingerprint(value: string): string {
  return value.trim().toLowerCase().slice(0, 256);
}

function normalizeSessionId(value: string): string {
  return value.trim().slice(0, SESSION_ID_MAX);
}

function hasCredentialSignal(req: Request): boolean {
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && /^Bearer\s+\S+/i.test(auth)) return true;
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  return Boolean(cookies?.[AUTH_ACCESS_COOKIE] || cookies?.[AUTH_REFRESH_COOKIE]);
}

function validateRequired(raw: Record<string, string | undefined>): string | null {
  const keys = [HDR_SCREEN, HDR_OS, HDR_BROWSER, HDR_TZ, HDR_FP, HDR_SID] as const;
  const labels: Record<string, string> = {
    [HDR_SCREEN]: HDR_SCREEN,
    [HDR_OS]: HDR_OS,
    [HDR_BROWSER]: HDR_BROWSER,
    [HDR_TZ]: HDR_TZ,
    [HDR_FP]: HDR_FP,
    [HDR_SID]: HDR_SID,
  };
  for (const k of keys) {
    const v = raw[k];
    if (v === undefined || v.length === 0) return labels[k] ?? k;
  }
  return null;
}

/** Resolução no formato largura x altura (dígitos). */
function isPlausibleScreen(screen: string): boolean {
  return /^\d{2,5}\s*x\s*\d{2,5}$/i.test((screen || '').trim());
}

function isPlausibleTimezone(tz: string): boolean {
  const t = (tz || '').trim().toLowerCase();
  if (t.length < 2) return false;
  if (t === 'utc' || t.startsWith('etc/')) return true;
  return /^[a-z]+\/.+/i.test(t);
}

/** Cabeçalho x-device-browser vs User-Agent (anti-spoof leve). */
function browserMatchesUserAgent(browserHdr: string, ua: string): boolean {
  const b = browserHdr.toLowerCase();
  const u = ua.toLowerCase();
  if (!u.trim()) return true;
  const mentionsChrome = b.includes('chrome') || b.includes('chromium');
  const mentionsFirefox = b.includes('firefox');
  const mentionsSafari = b.includes('safari') && !b.includes('chrome');
  const mentionsEdge = b.includes('edge') || b.includes('edg');

  if (mentionsChrome) {
    return (
      u.includes('chrome') ||
      u.includes('chromium') ||
      u.includes('edg') ||
      u.includes('opr/') ||
      u.includes('vivaldi')
    );
  }
  if (mentionsFirefox) return u.includes('firefox');
  if (mentionsSafari) return u.includes('safari') || u.includes('iphone') || u.includes('ipad');
  if (mentionsEdge) return u.includes('edg');
  return true;
}

function isValidFingerprintNormalized(fp: string): boolean {
  return fp.length >= FINGERPRINT_MIN_LEN;
}

function isValidSessionIdNormalized(sid: string): boolean {
  if (!sid || sid.length < 8 || sid.length > SESSION_ID_MAX) return false;
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sid);
  const loose = /^[a-zA-Z0-9._:-]+$/.test(sid);
  return uuid || loose;
}

/** Extrai `sub` do JWT Bearer sem validar assinatura (correlação de auditoria apenas). */
function tryDecodeJwtSub(req: Request): string | null {
  const auth = req.headers.authorization;
  if (typeof auth !== 'string' || !/^Bearer\s+\S+/i.test(auth)) return null;
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  const parts = token.split('.');
  if (parts.length < 2 || parts[1].length < 4) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as {
      sub?: string;
    };
    const sub = typeof payload.sub === 'string' ? payload.sub.trim() : '';
    return sub.length > 0 ? sub.slice(0, 64) : null;
  } catch {
    return null;
  }
}

function deviceTypeFromUa(ua: string): string {
  const s = ua.toLowerCase();
  if (/tablet|ipad/.test(s)) return 'tablet';
  if (/mobile|android|iphone|ipod/.test(s)) return 'mobile';
  return 'desktop';
}

export type SecurityHeadersMiddlewareDeps = {
  intrusion: IntrusionService;
  prisma: PrismaService;
  logger: Logger;
};

/**
 * Camada única de validação/normalização dos headers do Security Engine (Portal / Staff / Mobile).
 * Preenche `req.securityContext`, aciona `IntrusionService` e grava `device_auditorias` quando há `sub` no JWT.
 */
export function createSecurityHeadersMiddleware(deps: SecurityHeadersMiddlewareDeps) {
  const { intrusion, prisma, logger } = deps;

  return function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction): void {
    if (req.method === 'OPTIONS') {
      next();
      return;
    }

    const pathname = (req.originalUrl || req.url || '/').split('?')[0] || '/';

    if (isSecurityHeadersExemptPath(pathname)) {
      next();
      return;
    }

    if (!hasCredentialSignal(req)) {
      next();
      return;
    }

    const enforce = shouldEnforceSecurityHeaders();

    const raw = {
      [HDR_SCREEN]: pickHeader(req, HDR_SCREEN),
      [HDR_OS]: pickHeader(req, HDR_OS),
      [HDR_BROWSER]: pickHeader(req, HDR_BROWSER),
      [HDR_TZ]: pickHeader(req, HDR_TZ),
      [HDR_FP]: pickHeader(req, HDR_FP),
      [HDR_SID]: pickHeader(req, HDR_SID),
    };

    const missingLabel = validateRequired(raw);

    if (enforce && missingLabel) {
      logger.warn(`security_headers: bloqueado falta=${missingLabel} path=${pathname}`);
      res.status(400).json({
        statusCode: 400,
        message: MSG_400,
      });
      return;
    }

    if (!enforce && missingLabel) {
      const ip = String(req.ip || req.socket?.remoteAddress || '');
      void intrusion.reportSecurityDegradedHeaders(ip, `missing:${missingLabel}`).catch(() => undefined);
      void intrusion.trackMissingSecurityHeaders(ip).catch(() => undefined);
      next();
      return;
    }

    const device = {
      os: normalizeOsBrowser(raw[HDR_OS] as string),
      browser: normalizeOsBrowser(raw[HDR_BROWSER] as string),
      screen: normalizeScreen(raw[HDR_SCREEN] as string),
      timezone: normalizeTimezone(raw[HDR_TZ] as string),
    };

    const fingerprint = normalizeFingerprint(raw[HDR_FP] as string);
    const sessionId = normalizeSessionId(raw[HDR_SID] as string);
    const ua = req.get('user-agent') || '';

    const semanticErrors: string[] = [];
    if (!isValidFingerprintNormalized(fingerprint)) semanticErrors.push('fingerprint-invalido');
    if (!isValidSessionIdNormalized(sessionId)) semanticErrors.push('session-id-invalido');
    if (!isPlausibleScreen(device.screen)) semanticErrors.push('screen-invalido');
    if (!isPlausibleTimezone(device.timezone)) semanticErrors.push('timezone-invalido');
    if (!browserMatchesUserAgent(device.browser, ua)) semanticErrors.push('browser-ua-inconsistente');

    if (enforce && semanticErrors.length > 0) {
      logger.warn(`security_headers: semântica path=${pathname} erros=${semanticErrors.join(',')}`);
      res.status(400).json({
        statusCode: 400,
        message: MSG_400,
      });
      return;
    }

    if (!enforce && semanticErrors.length > 0) {
      const ip = String(req.ip || req.socket?.remoteAddress || '');
      void intrusion.reportSecurityDegradedHeaders(ip, semanticErrors.join(',')).catch(() => undefined);
      next();
      return;
    }

    const ctx: SecurityRequestContext = {
      device,
      fingerprint,
      sessionId,
    };
    req.securityContext = ctx;

    const ip = String(req.ip || req.socket?.remoteAddress || '');

    void intrusion.analyzeHeadersFromContext(ctx, ip, ua).catch((e: Error) => {
      logger.warn(`security_headers analyzeHeaders: ${e.message}`);
    });

    const userId = tryDecodeJwtSub(req);
    if (userId) {
      void persistDeviceAuditRow(prisma, req, ctx, userId, logger).catch((e: Error) => {
        logger.warn(`device_auditoria middleware: ${e.message}`);
      });
    }

    next();
  };
}

async function persistDeviceAuditRow(
  prisma: PrismaService,
  req: Request,
  ctx: SecurityRequestContext,
  userId: string,
  logger: Logger,
): Promise<void> {
  const ip = String(req.ip || req.socket?.remoteAddress || '');
  const ua = req.get('user-agent') || '';
  const rota = ((req as Request & { originalUrl?: string }).originalUrl || req.url || '').slice(0, 500);
  const metodo = req.method;
  let geoloc: string | null = null;
  try {
    await prisma.deviceAuditoria.create({
      data: {
        userId,
        clienteId: null,
        fingerprint: ctx.fingerprint.slice(0, 128),
        ip: ip.slice(0, 64),
        geoloc,
        userAgent: ua.slice(0, 1000),
        rota,
        metodo,
        deviceType: deviceTypeFromUa(ua),
        sessionId: ctx.sessionId.slice(0, 128),
        securityHeaders: {
          os: ctx.device.os,
          browser: ctx.device.browser,
          screen: ctx.device.screen,
          timezone: ctx.device.timezone,
        },
      },
    });
    (req as Request & { deviceAuditLoggedByMiddleware?: boolean }).deviceAuditLoggedByMiddleware = true;
  } catch (e) {
    logger.warn(`device_auditoria persist: ${(e as Error).message}`);
  }
}
