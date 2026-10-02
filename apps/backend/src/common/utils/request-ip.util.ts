import type { Request } from 'express';

/** IP real do cliente (proxy-aware). */
export function extractRequestIp(req?: Pick<Request, 'headers' | 'ip' | 'socket'> | null): string {
  if (!req) return 'unknown';
  const fwd = req.headers['x-forwarded-for'];
  const firstFwd =
    typeof fwd === 'string'
      ? fwd.split(',')[0]?.trim()
      : Array.isArray(fwd)
        ? fwd[0]?.split(',')[0]?.trim()
        : '';
  const raw = firstFwd || req.ip || req.socket?.remoteAddress || 'unknown';
  return String(raw).replace(/^::ffff:/, '').trim().slice(0, 64) || 'unknown';
}
