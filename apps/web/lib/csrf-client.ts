/** Deve coincidir com apps/backend/src/auth/csrf.constants.ts (CSRF_COOKIE_NAME). */
export const CSRF_COOKIE_NAME = "rl_csrf";

export function isCsrfProtectionActive(): boolean {
  return process.env.NEXT_PUBLIC_CSRF_ENABLED === "1";
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[$()*+.?[\\\]^{|}]/g, "\\$&")}=([^;]*)`));
  return m?.[1] ? decodeURIComponent(m[1]) : null;
}

export function getCsrfTokenFromBrowser(): string | null {
  return readCookie(CSRF_COOKIE_NAME);
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Anexa X-CSRF-Token em métodos mutáveis quando CSRF está ativo no front. */
export function applyCsrfHeaders(headers: Headers, method?: string): void {
  if (!isCsrfProtectionActive()) return;
  const m = (method || "GET").toUpperCase();
  if (!MUTATING.has(m)) return;
  const token = getCsrfTokenFromBrowser();
  if (token && !headers.has("X-CSRF-Token")) {
    headers.set("X-CSRF-Token", token);
  }
}
