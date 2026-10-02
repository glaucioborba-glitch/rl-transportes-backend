import { staffJson } from "@/lib/api/staff-client";

export type CadastroCentroCusto = {
  id: string;
  codigo: string;
  nome: string;
  tipo: string;
  paiId?: string | null;
  descricao?: string | null;
  ativo: boolean;
  colaboradoresVinculados?: number;
  equipamentosVinculados?: number;
};

export async function listCadastrosCentrosCusto(tipo?: string) {
  const qs = tipo ? `?tipo=${encodeURIComponent(tipo)}` : "";
  return staffJson<{ items: CadastroCentroCusto[]; total: number }>(
    `/v2/cadastros/centros-custo${qs}`,
  );
}

export async function getCadastroCentroCusto(id: string) {
  return staffJson<CadastroCentroCusto & { paiId: string }>(
    `/v2/cadastros/centros-custo/${encodeURIComponent(id)}`,
  );
}

export async function createCadastroCentroCusto(
  data: Omit<CadastroCentroCusto, "id" | "colaboradoresVinculados" | "equipamentosVinculados"> & {
    paiId?: string;
  },
) {
  return staffJson<CadastroCentroCusto>("/v2/cadastros/centros-custo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function updateCadastroCentroCusto(
  id: string,
  data: Omit<CadastroCentroCusto, "id" | "colaboradoresVinculados" | "equipamentosVinculados"> & {
    paiId?: string;
  },
) {
  return staffJson<CadastroCentroCusto>(`/v2/cadastros/centros-custo/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}
