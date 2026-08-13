import { staffJson } from "@/lib/api/staff-client";

export type CadastroTipoOperacao = {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  direcao: string;
  exigeContainer: boolean;
  exigeCaminhao: boolean;
  exigeEmpilhadeira: boolean;
  tempoPadrao: number | null;
  centroCustoPadrao: string | null;
  cor: string;
  ativo: boolean;
};

export async function listCadastrosTiposOperacao() {
  return staffJson<{ items: CadastroTipoOperacao[]; total: number }>("/v2/cadastros/tipos-operacao");
}

export async function getCadastroTipoOperacao(id: string) {
  return staffJson<CadastroTipoOperacao>(`/v2/cadastros/tipos-operacao/${encodeURIComponent(id)}`);
}

export async function createCadastroTipoOperacao(data: Omit<CadastroTipoOperacao, "id">) {
  return staffJson<CadastroTipoOperacao>("/v2/cadastros/tipos-operacao", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function updateCadastroTipoOperacao(id: string, data: Omit<CadastroTipoOperacao, "id">) {
  return staffJson<CadastroTipoOperacao>(`/v2/cadastros/tipos-operacao/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}
