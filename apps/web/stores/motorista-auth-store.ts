import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthLoginResponse } from "@/lib/api/types";

export type MotoristaUser = AuthLoginResponse["user"];

type State = {
  accessToken: string | null;
  refreshToken: string | null;
  user: MotoristaUser | null;
  setSession: (access: string, refresh: string, user?: MotoristaUser | null) => void;
  clear: () => void;
};

export const useMotoristaAuthStore = create<State>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setSession: (access, refresh, user) =>
        set({ accessToken: access, refreshToken: refresh, user: user ?? null }),
      clear: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    {
      name: "rl-motorista-auth",
      partialize: (s) => ({
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        user: s.user,
      }),
    },
  ),
);
