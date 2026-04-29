const COOKIE = "rl_staff_session";

function secureFlag(): string {
  if (typeof window === "undefined") return "";
  return window.location.protocol === "https:" ? "; Secure" : "";
}

export function setStaffSessionCookie() {
  if (typeof document === "undefined") return;
  const maxAge = 60 * 60 * 24 * 30;
  document.cookie = `${COOKIE}=1; path=/; max-age=${maxAge}; SameSite=Lax${secureFlag()}`;
}

export function clearStaffSessionCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE}=; path=/; max-age=0${secureFlag()}`;
}
