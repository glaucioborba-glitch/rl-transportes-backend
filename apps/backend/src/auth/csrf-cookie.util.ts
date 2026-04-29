import type { Response } from 'express';
import { resolveCookieSecurityFlags } from './auth-cookie.util';
import { CSRF_COOKIE_NAME } from './csrf.constants';
import { gerarCSRFToken } from '../common/security/csrftoken.util';

const CSRF_MAX_MS = 12 * 60 * 60 * 1000;

export function attachCsrfCookie(res: Response, token: string): void {
  if (!isCsrfFeatureOn()) return;
  const { secure, sameSite } = resolveCookieSecurityFlags();
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure,
    sameSite,
    path: '/',
    maxAge: CSRF_MAX_MS,
  });
}

/** Gera e envia novo token CSRF (após login ou refresh). */
export function attachFreshCsrfCookie(res: Response): void {
  attachCsrfCookie(res, gerarCSRFToken());
}

export function clearCsrfCookie(res: Response): void {
  const { secure, sameSite } = resolveCookieSecurityFlags();
  res.clearCookie(CSRF_COOKIE_NAME, { path: '/', secure, sameSite });
}

function isCsrfFeatureOn(): boolean {
  return process.env.CSRF_ENABLED === '1';
}
