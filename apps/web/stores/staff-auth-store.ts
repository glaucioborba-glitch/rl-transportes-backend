import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthLoginResponse } from "@/lib/api/types";
import { isAuthHttpOnlyMode } from "@/lib/auth-mode";

export type StaffUser = AuthLoginResponse["user"];

const STAFF_ROLES = new Set([
  "ADMIN",
  "GERENTE",
  "OPERADOR_PORTARIA",
  "OPERADOR_GATE",
  "OPERADOR_PATIO",
]);

export function isStaffRole(role: string): boolean {
  return STAFF_ROLES.has(role);
}

type StaffAuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: StaffUser | null;
  setSession: (access: string | null, refresh: string | null, user?: StaffUser | null) => void;
  clear: () => void;
};

export const useStaffAuthStore = create<StaffAuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setSession: (access, refresh, user) =>
        set({
          accessToken: access,
          refreshToken: refresh,
          user: user ?? null,
        }),
      clear: () =>
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
        }),
    }),
    {
      name: "rl-staff-auth",
      partialize: (s) =>
        isAuthHttpOnlyMode()
          ? { user: s.user, accessToken: null, refreshToken: null }
          : {
              accessToken: s.accessToken,
              refreshToken: s.refreshToken,
              user: s.user,
            },
    },
  ),
);
