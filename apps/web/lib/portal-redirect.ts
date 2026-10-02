/** Landing pós-login do portal cliente (home operacional). */
export const DEFAULT_PORTAL_HOME = "/portal/solicitacoes";

const DEFAULT_PORTAL = DEFAULT_PORTAL_HOME;

/** Evita open-redirect (ex.: ?next=//site.com) e garante path interno. */
export function sanitizePortalNext(next: string | string[] | undefined): string {
  const v = Array.isArray(next) ? next[0] : next;
  if (typeof v !== "string" || !v.startsWith("/") || v.startsWith("//")) {
    return DEFAULT_PORTAL;
  }
  return v;
}

export function sanitizePortalPath(path: string | undefined): string {
  if (!path || typeof path !== "string" || !path.startsWith("/") || path.startsWith("//")) {
    return DEFAULT_PORTAL;
  }
  return path.startsWith("/portal") ? path : DEFAULT_PORTAL;
}
