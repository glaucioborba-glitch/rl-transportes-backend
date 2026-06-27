import { create } from "zustand";
import type { AuthLoginResponse, PortalClienteSnapshot } from "@/lib/api/types";
import { resolvePortalClienteDisplayName } from "@/lib/portal-cliente-display";

/** Tokens só em memória (sem localStorage). Modo cookie: tokens vazios, sessão em rl_pat/rl_prt. */
export type PortalUser = AuthLoginResponse["user"];

type PortalClienteAuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: PortalUser | null;
  cliente: PortalClienteSnapshot | null;
  clienteNome: string | null;
  dashboardRevision: number;
  sessionHydrated: boolean;
  isBloqueadoFinanceiramente: boolean;
  bloqueioFinanceiroHydrated: boolean;
  setSession: (access: string, refresh: string, user?: PortalUser | null) => void;
  setSessionHydrated: (hydrated: boolean) => void;
  setCliente: (cliente: PortalClienteSnapshot | null) => void;
  setClienteNome: (nome: string | null) => void;
  setUser: (user: PortalUser | null) => void;
  setBloqueioFinanceiro: (blocked: boolean) => void;
  bumpDashboard: () => void;
  clear: () => void;
};

export const usePortalClienteAuthStore = create<PortalClienteAuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  cliente: null,
  clienteNome: null,
  dashboardRevision: 0,
  sessionHydrated: false,
  isBloqueadoFinanceiramente: false,
  bloqueioFinanceiroHydrated: false,
  setSession: (access, refresh, user) =>
    set((s) => ({
      accessToken: access,
      refreshToken: refresh,
      user: user !== undefined ? user : s.user,
      sessionHydrated: true,
    })),
  setSessionHydrated: (sessionHydrated) => set({ sessionHydrated }),
  setCliente: (cliente) =>
    set({
      cliente,
      clienteNome: resolvePortalClienteDisplayName(cliente),
    }),
  setClienteNome: (nome) => set({ clienteNome: nome?.trim() || null }),
  setUser: (user) => set({ user }),
  setBloqueioFinanceiro: (isBloqueadoFinanceiramente) =>
    set({ isBloqueadoFinanceiramente, bloqueioFinanceiroHydrated: true }),
  bumpDashboard: () => set((s) => ({ dashboardRevision: s.dashboardRevision + 1 })),
  clear: () => {
    set({
      accessToken: null,
      refreshToken: null,
      user: null,
      cliente: null,
      clienteNome: null,
      dashboardRevision: 0,
      sessionHydrated: false,
      isBloqueadoFinanceiramente: false,
      bloqueioFinanceiroHydrated: false,
    });
    if (typeof window !== "undefined") {
      try {
        const { usePessoaAutorizadaStore } =
          require("@/stores/pessoaAutorizadaStore") as typeof import("@/stores/pessoaAutorizadaStore");
        usePessoaAutorizadaStore.getState().clear();
      } catch {
        /* */
      }
      try {
        const { usePessoaPermissoesStore } =
          require("@/stores/pessoaPermissoesStore") as typeof import("@/stores/pessoaPermissoesStore");
        usePessoaPermissoesStore.getState().clear();
      } catch {
        /* */
      }
      try {
        const { clearPortalMinhasPermissoesCache } =
          require("@/lib/api/portal-client") as typeof import("@/lib/api/portal-client");
        clearPortalMinhasPermissoesCache();
      } catch {
        /* */
      }
    }
  },
}));

/** Limpa também identidade de pessoa autorizada (login corporativo). */
export async function clearPortalClienteSession() {
  const { logoutPortalCliente } = await import("@/lib/portal-logout");
  await logoutPortalCliente();
}
