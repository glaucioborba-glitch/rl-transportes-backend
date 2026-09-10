/** Cookies HttpOnly do portal (rl_pat / rl_prt) via BFF Next `/api/portal/*`. */
export function isPortalCookieAuthMode(): boolean {
  if (process.env.NEXT_PUBLIC_PORTAL_COOKIE_AUTH === "0") return false;
  if (process.env.NEXT_PUBLIC_PORTAL_COOKIE_AUTH === "1") return true;
  return process.env.NODE_ENV === "production";
}

/** Sessão válida: JWT em memória ou cookie HttpOnly + user hidratado. */
export function hasPortalClientSession(state: {
  accessToken: string | null;
  sessionHydrated?: boolean;
  user: unknown | null;
}): boolean {
  if (state.accessToken?.trim()) return true;
  return Boolean(isPortalCookieAuthMode() && state.sessionHydrated && state.user);
}
