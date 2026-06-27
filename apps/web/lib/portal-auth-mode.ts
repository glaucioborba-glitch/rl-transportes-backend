/** Modo cookies HttpOnly portal (rl_pat / rl_prt) via BFF Next `/api/portal/*`. */
export function isPortalCookieAuthMode(): boolean {
  return process.env.NEXT_PUBLIC_PORTAL_COOKIE_AUTH === "1";
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
