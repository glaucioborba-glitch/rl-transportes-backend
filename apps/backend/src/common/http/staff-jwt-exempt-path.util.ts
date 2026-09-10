/** Normaliza path Express (`/health` vs `/health/`). */
export function normalizeHttpPath(path: string): string {
  const raw = (path.split('?')[0] || path).trim() || '/';
  if (raw.length > 1 && raw.endsWith('/')) return raw.slice(0, -1);
  return raw;
}

const AUTH_PUBLIC = new Set([
  '/auth/login',
  '/auth/refresh',
  '/auth/register',
  '/auth/reset-password',
  '/portal/login',
  '/portal/refresh',
  '/portal/logout',
  '/portal/register',
  '/portal/esqueci-senha',
  '/portal/redefinir-senha',
  '/portal/2fa',
]);

/**
 * Prefixos com auth própria (portal CX, mobile v1, API key, HMAC).
 * JWT staff global não deve rejeitar esses tokens.
 */
export function isStaffJwtExemptPath(path: string): boolean {
  const p = normalizeHttpPath(path);

  if (p === '/health' || p === '/health/db') return true;
  if (p.startsWith('/docs')) return true;
  if (AUTH_PUBLIC.has(p)) return true;
  if (p.startsWith('/portal/auth/')) return true;

  if (p.startsWith('/portal/')) return true;
  if (p.startsWith('/cliente/') && !p.startsWith('/clientes')) return true;
  if (p.startsWith('/fornecedor/')) return true;
  if (p.startsWith('/mobile/v1/')) return true;
  if (p === '/mobile' || p.startsWith('/mobile/')) return true;
  if (p.startsWith('/public/')) return true;
  if (p.startsWith('/marketplace/')) return true;
  if (p.startsWith('/gateway/')) return true;
  if (p.startsWith('/integracao/')) return true;
  if (p.startsWith('/cliente-api/')) return true;
  if (p.startsWith('/address/')) return true;
  if (p.startsWith('/v2/gate/vistoria/media')) return true;
  if (p.startsWith('/client/container')) return true;
  if (/^\/v2\/solicitacoes\/[^/]+\/(pdf|verificar)$/.test(p)) return true;

  return false;
}
