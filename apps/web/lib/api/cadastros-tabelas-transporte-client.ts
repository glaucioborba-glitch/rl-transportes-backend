import { staffJson } from "@/lib/api/staff-client";

export type CadastroTabelaTransporte = {
  id: string;
  nome: string;
  descricao?: string | null;
  dataInicio: string;
  dataFim?: string | null;
  ativo: boolean;
  padrao: boolean;
  itensCount?: number;
};

export type CadastroTabelaTransporteForm = {
  nome: string;
  descricao?: string;
  dataInicio?: string;
  dataFim?: string;
  ativo?: boolean;
  padrao?: boolean;
  duplicarDeId?: string;
};

export async function listCadastrosTabelasTransporte() {
  return staffJson<{ items: CadastroTabelaTransporte[]; total: number }>(
    "/v2/cadastros/tabelas-transporte",
  );
}

export async function getCadastroTabelaTransporte(id: string) {
  return staffJson<CadastroTabelaTransporte>(
    `/v2/cadastros/tabelas-transporte/${encodeURIComponent(id)}`,
  );
}

export async function createCadastroTabelaTransporte(data: CadastroTabelaTransporteForm) {
  return staffJson<CadastroTabelaTransporte>("/v2/cadastros/tabelas-transporte", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function updateCadastroTabelaTransporte(
  id: string,
  data: CadastroTabelaTransporteForm,
) {
  return staffJson<CadastroTabelaTransporte>(
    `/v2/cadastros/tabelas-transporte/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );
}
