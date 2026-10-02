import { normalizeHttpPath } from './staff-jwt-exempt-path.util';

/** Login / refresh — brute force (não pular o limiter global). */
export function isAuthBruteForcePath(path: string): boolean {
  const p = normalizeHttpPath(path);
  if (p === '/auth/login' || p === '/auth/refresh' || p === '/auth/register' || p === '/auth/reset-password') {
    return true;
  }
  if (p === '/portal/login' || p === '/portal/refresh' || p === '/portal/register') return true;
  if (p.startsWith('/portal/auth/')) return true;
  if (p === '/mobile/v1/auth' || p.startsWith('/mobile/v1/auth/')) return true;
  return false;
}
