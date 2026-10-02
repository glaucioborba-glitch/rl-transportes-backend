import { create } from "zustand";

type PendenciasCadastroState = {
  count: number;
  setCount: (count: number) => void;
  decrement: () => void;
  reset: () => void;
};

export const usePendenciasCadastroStore = create<PendenciasCadastroState>((set) => ({
  count: 0,
  setCount: (count) => set({ count: Math.max(0, count) }),
  decrement: () => set((s) => ({ count: Math.max(0, s.count - 1) })),
  reset: () => set({ count: 0 }),
}));

export function usePendenciasCadastroCount() {
  return usePendenciasCadastroStore((s) => s.count);
}
