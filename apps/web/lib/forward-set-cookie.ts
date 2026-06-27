import type { NextResponse } from "next/server";

/**
 * Browsers rejeitam `SameSite=None` sem `Secure`. Em dev o Nest pode ainda emitir None;
 * ao repassar pelo proxy Next (mesma origem :3000) normalizamos para Lax.
 */
function normalizeSetCookieForBrowser(setCookie: string): string {
  if (process.env.NODE_ENV === "production") return setCookie;
  return setCookie
    .replace(/;\s*SameSite=None\b/gi, "; SameSite=Lax")
    .replace(/;\s*Secure\b(?=;|$)/gi, "");
}

function cookieName(setCookie: string): string | null {
  const name = setCookie.split("=")[0]?.trim();
  return name || null;
}

/** Nest emite clear + set no login; ignorar clears quando o mesmo cookie será redefinido. */
function isExpiredClearCookie(setCookie: string): boolean {
  return (
    /;\s*Max-Age=0\b/i.test(setCookie) ||
    /;\s*Expires=Thu,\s*01 Jan 1970/i.test(setCookie)
  );
}

function filterRedundantClearCookies(cookies: string[]): string[] {
  const keptNames = new Set<string>();
  for (const c of cookies) {
    const name = cookieName(c);
    if (name && !isExpiredClearCookie(c)) keptNames.add(name);
  }
  return cookies.filter((c) => {
    const name = cookieName(c);
    if (!name) return true;
    if (isExpiredClearCookie(c) && keptNames.has(name)) return false;
    return true;
  });
}

/** Repassa múltiplos Set-Cookie do upstream (Nest) para a resposta Next (browser). */
export function forwardSetCookieHeaders(upstream: Response, res: NextResponse): void {
  const list =
    typeof upstream.headers.getSetCookie === "function" ? upstream.headers.getSetCookie() : [];
  if (list.length) {
    for (const c of filterRedundantClearCookies(list.map(normalizeSetCookieForBrowser))) {
      res.headers.append("Set-Cookie", c);
    }
    return;
  }
  const single = upstream.headers.get("set-cookie");
  if (single) res.headers.append("Set-Cookie", normalizeSetCookieForBrowser(single));
}
