import { create } from "zustand";
import { persist } from "zustand/middleware";

export type PessoaAutorizada = {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
};

type PessoaAutorizadaState = {
  pessoa: PessoaAutorizada | null;
  setPessoa: (pessoa: PessoaAutorizada | null) => void;
  clear: () => void;
};

export const usePessoaAutorizadaStore = create<PessoaAutorizadaState>()(
  persist(
    (set) => ({
      pessoa: null,
      setPessoa: (pessoa) => set({ pessoa }),
      clear: () => set({ pessoa: null }),
    }),
    { name: "pessoaAutorizada" },
  ),
);

export function readPessoaAutorizadaLocal(): PessoaAutorizada | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("pessoaAutorizada");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { pessoa?: PessoaAutorizada | null } };
    return parsed?.state?.pessoa ?? null;
  } catch {
    return null;
  }
}
