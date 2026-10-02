import { staffJson } from "@/lib/api/staff-client";

export type CadastroPlanoConta = {
  id: string;
  codigo: string;
  nome: string;
  natureza: string;
  tipo: string;
  paiId?: string | null;
  descricao?: string | null;
  ativo: boolean;
};

export async function listCadastrosPlanoContas(tipo?: string) {
  const qs = tipo ? `?tipo=${encodeURIComponent(tipo)}` : "";
  return staffJson<{ items: CadastroPlanoConta[]; total: number }>(
    `/v2/cadastros/plano-contas${qs}`,
  );
}

export async function getCadastroPlanoConta(id: string) {
  return staffJson<CadastroPlanoConta & { paiId: string }>(
    `/v2/cadastros/plano-contas/${encodeURIComponent(id)}`,
  );
}

export async function createCadastroPlanoConta(
  data: Omit<CadastroPlanoConta, "id"> & { paiId?: string },
) {
  return staffJson<CadastroPlanoConta>("/v2/cadastros/plano-contas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function updateCadastroPlanoConta(
  id: string,
  data: Omit<CadastroPlanoConta, "id"> & { paiId?: string },
) {
  return staffJson<CadastroPlanoConta>(`/v2/cadastros/plano-contas/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}
