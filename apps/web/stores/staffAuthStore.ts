import { create } from "zustand";
import type { AuthLoginResponse } from "@/lib/api/types";

export type StaffUser = AuthLoginResponse["user"];

const STAFF_ROLES = new Set([
  "SUPER_ADMIN",
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
  /** Só dados exibidos na UI; tokens ficam em cookies HttpOnly (API). */
  user: StaffUser | null;
  setUser: (user: StaffUser | null) => void;
  /** Compat: ignora tokens (sempre HttpOnly). */
  setSession: (_access: string | null, _refresh: string | null, user?: StaffUser | null) => void;
  clear: () => void;
};

export const useStaffAuthStore = create<StaffAuthState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  setSession: (_a, _r, user) => set({ user: user ?? null }),
  clear: () => set({ user: null }),
}));
