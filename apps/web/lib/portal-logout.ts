import { clearPortalMinhasPermissoesCache, portalLogoutCookies } from "@/lib/api/portal-client";
import { isPortalCookieAuthMode } from "@/lib/portal-auth-mode";
import { usePortalClienteAuthStore } from "@/stores/portalClienteAuthStore";

/** Encerra sessão portal: cookies HttpOnly + stores locais. */
export async function logoutPortalCliente(): Promise<void> {
  if (isPortalCookieAuthMode()) {
    await portalLogoutCookies();
  }
  usePortalClienteAuthStore.getState().clear();
  try {
    const { usePessoaAutorizadaStore } =
      await import("@/stores/pessoaAutorizadaStore");
    usePessoaAutorizadaStore.getState().clear();
  } catch {
    /* */
  }
  try {
    const { usePessoaPermissoesStore } =
      await import("@/stores/pessoaPermissoesStore");
    usePessoaPermissoesStore.getState().clear();
  } catch {
    /* */
  }
  clearPortalMinhasPermissoesCache();
}
