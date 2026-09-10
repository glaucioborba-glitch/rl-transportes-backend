import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { StateStorage } from "zustand/middleware";

export {
  usePortalClienteAuthStore,
  usePortalClienteAuthStore as usePortalAuthStore,
  type PortalUser,
} from "./portalClienteAuthStore";

const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

const ssrSafeJsonStorage = createJSONStorage(() =>
  typeof window === "undefined" ? noopStorage : window.localStorage,
);

type ThemeMode = "dark" | "light";

type ThemeState = {
  mode: ThemeMode;
  locale: "pt-BR";
  setMode: (m: ThemeMode) => void;
  toggleMode: () => void;
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: "dark",
      locale: "pt-BR",
      setMode: (m) => set({ mode: m }),
      toggleMode: () => set({ mode: get().mode === "light" ? "dark" : "light" }),
    }),
    { name: "rl-portal-theme", storage: ssrSafeJsonStorage },
  ),
);
