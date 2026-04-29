import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthLoginResponse } from "@/lib/api/types";

export type PortalUser = AuthLoginResponse["user"];

type PortalAuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: PortalUser | null;
  clienteNome: string | null;
  /** Incrementado após mutações (ex.: aprovar solicitação) para recarregar o dashboard. */
  dashboardRevision: number;
  setSession: (access: string, refresh: string, user?: PortalUser | null) => void;
  setClienteNome: (nome: string | null) => void;
  setUser: (user: PortalUser | null) => void;
  bumpDashboard: () => void;
  clear: () => void;
};

export const usePortalAuthStore = create<PortalAuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      clienteNome: null,
      dashboardRevision: 0,
      setSession: (access, refresh, user) =>
        set({
          accessToken: access,
          refreshToken: refresh,
          user: user ?? null,
        }),
      setClienteNome: (nome) => set({ clienteNome: nome }),
      setUser: (user) => set({ user }),
      bumpDashboard: () => set((s) => ({ dashboardRevision: s.dashboardRevision + 1 })),
      clear: () =>
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          clienteNome: null,
          dashboardRevision: 0,
        }),
    }),
    {
      name: "rl-portal-auth",
      partialize: (s) => ({
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        user: s.user,
        clienteNome: s.clienteNome,
      }),
    },
  ),
);

type ThemeState = {
  mode: "dark";
  locale: "pt-BR";
  setMode: (m: "dark") => void;
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: "dark",
      locale: "pt-BR",
      setMode: (m) => set({ mode: m }),
    }),
    { name: "rl-portal-theme" },
  ),
);
