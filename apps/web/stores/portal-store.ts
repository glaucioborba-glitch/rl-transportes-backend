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
    { name: "rl-portal-theme", storage: ssrSafeJsonStorage },
  ),
);
