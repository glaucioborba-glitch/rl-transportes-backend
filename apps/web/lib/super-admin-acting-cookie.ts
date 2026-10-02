/** Deve coincidir com AUTH_SA_TENANT_* no Nest. */
export const SA_ACTING_TENANT_COOKIE = "rl_sa_tenant";
export const SA_ACTING_TENANT_LABEL_COOKIE = "rl_sa_tenant_label";

/** LAN HTTP (demo): AUTH_COOKIE_SECURE=0. Sem isso o Chrome descarta o cookie em http://IP:3000. */
export function actingCookieSecure(): boolean {
  if (process.env.AUTH_COOKIE_SECURE === "0" || process.env.AUTH_COOKIE_SECURE === "false") {
    return false;
  }
  if (process.env.AUTH_COOKIE_SECURE === "1" || process.env.AUTH_COOKIE_SECURE === "true") {
    return true;
  }
  return process.env.NODE_ENV === "production";
}

export function readSaActingTenantLabel(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(
    new RegExp(`(?:^|; )${SA_ACTING_TENANT_LABEL_COOKIE}=([^;]*)`),
  );
  if (!m?.[1]) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}
