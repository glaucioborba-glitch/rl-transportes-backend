const COOKIE = "rl_motorista_session";

export function setMotoristaSessionCookie() {
  if (typeof document === "undefined") return;
  const maxAge = 60 * 60 * 24 * 30;
  document.cookie = `${COOKIE}=1; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function clearMotoristaSessionCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE}=; path=/; max-age=0`;
}
