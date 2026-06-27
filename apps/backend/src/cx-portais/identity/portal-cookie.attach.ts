import type { Response } from 'express';
import { PORTAL_ACCESS_COOKIE, PORTAL_REFRESH_COOKIE } from './portal-cookie.constants';

const DEFAULT_ACCESS_MS = 60 * 60 * 1000;
const DEFAULT_REFRESH_MS = 7 * 24 * 60 * 60 * 1000;

function cookieFlags() {
  const secure =
    process.env.NODE_ENV === 'production' ||
    process.env.PORTAL_COOKIE_SECURE === '1' ||
    process.env.AUTH_COOKIE_SECURE === '1';
  return { secure, sameSite: 'lax' as const };
}

export function attachPortalAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  const { secure, sameSite } = cookieFlags();
  const accessMs = Math.max(
    60_000,
    parseInt(process.env.PORTAL_ACCESS_COOKIE_MAX_MS || '', 10) || DEFAULT_ACCESS_MS,
  );
  const refreshMs = Math.max(
    accessMs,
    parseInt(process.env.PORTAL_REFRESH_COOKIE_MAX_MS || '', 10) || DEFAULT_REFRESH_MS,
  );
  res.cookie(PORTAL_ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    maxAge: accessMs,
  });
  res.cookie(PORTAL_REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    maxAge: refreshMs,
  });
}

export function attachPortalAccessCookie(res: Response, accessToken: string): void {
  const { secure, sameSite } = cookieFlags();
  const accessMs = Math.max(
    60_000,
    parseInt(process.env.PORTAL_ACCESS_COOKIE_MAX_MS || '', 10) || DEFAULT_ACCESS_MS,
  );
  res.cookie(PORTAL_ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    maxAge: accessMs,
  });
}

export function clearPortalAuthCookies(res: Response): void {
  const { secure, sameSite } = cookieFlags();
  const opts = { path: '/', httpOnly: true, secure, sameSite, maxAge: 0 };
  res.clearCookie(PORTAL_ACCESS_COOKIE, opts);
  res.clearCookie(PORTAL_REFRESH_COOKIE, opts);
}
