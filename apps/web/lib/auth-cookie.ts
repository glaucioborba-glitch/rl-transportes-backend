const COOKIE = "rl_portal_session";

export function setPortalSessionCookie() {
  if (typeof document === "undefined") return;
  const maxAge = 60 * 60 * 24 * 30;
  document.cookie = `${COOKIE}=1; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function clearPortalSessionCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE}=; path=/; max-age=0`;
}
