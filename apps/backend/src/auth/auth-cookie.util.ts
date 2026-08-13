import type { Response } from 'express';
import { AUTH_ACCESS_COOKIE, AUTH_REFRESH_COOKIE } from './auth-cookie.constants';

const DEFAULT_ACCESS_MS = 60 * 60 * 1000;
const DEFAULT_REFRESH_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Cookies HttpOnly de sessão staff:
 * - `secure` apenas em produção (HTTPS); localhost pode usar HTTP.
 * - `sameSite: lax` mitiga CSRF mantendo navegação top-level.
 */
export function resolveCookieSecurityFlags(): {
  secure: boolean;
  sameSite: 'lax';
} {
  const secure =
    process.env.NODE_ENV === 'production' ||
    process.env.AUTH_COOKIE_SECURE === '1' ||
    process.env.AUTH_COOKIE_SECURE === 'true';
  return { sameSite: 'lax', secure };
}

/** Atualiza somente o cookie de access token (renovação silenciosa). */
export function attachAccessCookie(res: Response, accessToken: string): void {
  const { secure, sameSite } = resolveCookieSecurityFlags();
  const accessMs = Math.max(60_000, parseInt(process.env.AUTH_ACCESS_COOKIE_MAX_MS || '', 10) || DEFAULT_ACCESS_MS);
  res.cookie(AUTH_ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    maxAge: accessMs,
  });
}

/** Define cookies HttpOnly (sempre via res.cookie). */
export function attachAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  const { secure, sameSite } = resolveCookieSecurityFlags();
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
  const { secure, sameSite } = resolveCookieSecurityFlags();
  const opts = {
    path: '/',
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    maxAge: 0,
  };
  res.clearCookie('rl_at', opts);
  res.clearCookie('rl_rt', opts);
}
