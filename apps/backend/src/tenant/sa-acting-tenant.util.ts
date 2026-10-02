import { AUTH_SA_TENANT_COOKIE } from '../auth/auth-cookie.constants';

const TENANT_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/i;

export function parseSaActingTenantId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const id = raw.trim();
  if (!TENANT_ID_RE.test(id)) return null;
  return id;
}

export function readSaActingTenantCookie(cookies?: Record<string, string | undefined>): string | null {
  return parseSaActingTenantId(cookies?.[AUTH_SA_TENANT_COOKIE]);
}

/** Rotas do cockpit SaaS — não isolam pelo cookie de intranet. */
export function isSuperAdminConsolePath(path: string): boolean {
  const p = (path.split('?')[0] || '').replace(/\/+$/, '') || '/';
  return p === '/super-admin' || p.startsWith('/super-admin/');
}
