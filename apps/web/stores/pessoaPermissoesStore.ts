import { create } from "zustand";
import { persist } from "zustand/middleware";

export type PermissoesPessoa = {
  podeCriarSolicitacao: boolean;
  podeAnexarDocumentos: boolean;
  podeAgendarTurno: boolean;
  podeVisualizarFinanceiro: boolean;
  podeAprovarOS: boolean;
  podeVerOS: boolean;
  podeAlterarDadosGate: boolean;
  podeGerarPDF: boolean;
  podeGerenciarPessoas: boolean;
};

export const DEFAULT_PERMISSOES: PermissoesPessoa = {
  podeCriarSolicitacao: true,
  podeAnexarDocumentos: true,
  podeAgendarTurno: true,
  podeVisualizarFinanceiro: false,
  podeAprovarOS: false,
  podeVerOS: true,
  podeAlterarDadosGate: false,
  podeGerarPDF: true,
  podeGerenciarPessoas: false,
};

type PessoaPermissoesState = {
  permissoes: PermissoesPessoa | null;
  /** Pessoa à qual as permissões em cache pertencem (evita stale após troca). */
  boundPessoaId: string | null;
  setPermissoes: (permissoes: PermissoesPessoa | null, pessoaId?: string | null) => void;
  clear: () => void;
};

export const usePessoaPermissoesStore = create<PessoaPermissoesState>()(
  persist(
    (set) => ({
      permissoes: null,
      boundPessoaId: null,
      setPermissoes: (permissoes, pessoaId) =>
        set({
          permissoes,
          boundPessoaId: pessoaId !== undefined ? pessoaId : null,
        }),
      clear: () => set({ permissoes: null, boundPessoaId: null }),
    }),
    { name: "sessionPermissoes" },
  ),
);

export function pode(permissao: keyof PermissoesPessoa): boolean {
  const p = usePessoaPermissoesStore.getState().permissoes;
  if (!p) return false;
  return !!p[permissao];
}
