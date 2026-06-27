import { PORTAL_ACCESS_COOKIE, PORTAL_REFRESH_COOKIE } from './portal-cookie.constants';

export { PORTAL_ACCESS_COOKIE, PORTAL_REFRESH_COOKIE };

/** Cliente pede cookies HttpOnly via BFF Next (`/api/portal/*`). */
export function wantsPortalCookieAuth(req: { headers: Record<string, unknown> }): boolean {
  return (
    process.env.PORTAL_HTTP_ONLY_COOKIES === '1' &&
    String(req.headers['x-rl-portal-cookie'] ?? req.headers['X-RL-Portal-Cookie'] ?? '') === '1'
  );
}

export function extractPortalAccessToken(req: {
  headers: { authorization?: string };
  cookies?: Record<string, string>;
}): string | null {
  const bearer = /^Bearer\s+(.+)$/i.exec(req.headers.authorization ?? '');
  if (bearer?.[1]?.trim()) return bearer[1].trim();
  if (process.env.PORTAL_HTTP_ONLY_COOKIES === '1') {
    return req.cookies?.[PORTAL_ACCESS_COOKIE] ?? null;
  }
  return null;
}

export function extractPortalRefreshToken(req: {
  cookies?: Record<string, string>;
}): string | undefined {
  return req.cookies?.[PORTAL_REFRESH_COOKIE];
}
