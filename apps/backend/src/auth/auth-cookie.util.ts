import type { Response } from 'express';
import { AUTH_ACCESS_COOKIE, AUTH_REFRESH_COOKIE } from './auth-cookie.constants';

const DEFAULT_ACCESS_MS = 60 * 60 * 1000;
const DEFAULT_REFRESH_MS = 7 * 24 * 60 * 60 * 1000;

function cookieBaseOptions(): { secure: boolean; sameSite: 'lax' | 'strict' | 'none' } {
  const secure = process.env.NODE_ENV === 'production' || process.env.AUTH_COOKIE_SECURE === '1';
  const raw = (process.env.AUTH_COOKIE_SAMESITE || 'lax').toLowerCase();
  const sameSite: 'lax' | 'strict' | 'none' =
    raw === 'none' ? 'none' : raw === 'strict' ? 'strict' : 'lax';
  return { secure, sameSite };
}

/** Define cookies HttpOnly com JWT (modo navegador + CORS com credentials). */
export function attachAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  const { secure, sameSite } = cookieBaseOptions();
  const accessMs = Math.max(60_000, parseInt(process.env.AUTH_ACCESS_COOKIE_MAX_MS || '', 10) || DEFAULT_ACCESS_MS);
  const refreshMs = Math.max(
    accessMs,
    parseInt(process.env.AUTH_REFRESH_COOKIE_MAX_MS || '', 10) || DEFAULT_REFRESH_MS,
  );
  res.cookie(AUTH_ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    maxAge: accessMs,
  });
  res.cookie(AUTH_REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    maxAge: refreshMs,
  });
}

export function clearAuthCookies(res: Response): void {
  const { secure, sameSite } = cookieBaseOptions();
  res.clearCookie(AUTH_ACCESS_COOKIE, { path: '/', secure, sameSite });
  res.clearCookie(AUTH_REFRESH_COOKIE, { path: '/', secure, sameSite });
}
