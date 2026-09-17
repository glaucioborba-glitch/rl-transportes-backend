/** Deve coincidir com AUTH_SA_TENANT_* no Nest. */
export const SA_ACTING_TENANT_COOKIE = "rl_sa_tenant";
export const SA_ACTING_TENANT_LABEL_COOKIE = "rl_sa_tenant_label";

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
