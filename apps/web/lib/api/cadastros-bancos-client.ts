import { staffJson } from "@/lib/api/staff-client";

export type CadastroBanco = {
  id: string;
  codigo: string;
  nome: string;
  cnpj: string | null;
  site: string | null;
  ativo: boolean;
  contasVinculadas?: number;
};

export async function listCadastrosBancos(search?: string) {
  const qs = search?.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
  return staffJson<{ items: CadastroBanco[]; total: number }>(`/v2/cadastros/bancos${qs}`);
}

export async function getCadastroBanco(id: string) {
  return staffJson<CadastroBanco>(`/v2/cadastros/bancos/${encodeURIComponent(id)}`);
}

export async function createCadastroBanco(data: {
  codigo: string;
  nome: string;
  cnpj?: string | null;
  site?: string | null;
  ativo: boolean;
}) {
  return staffJson<CadastroBanco>("/v2/cadastros/bancos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function updateCadastroBanco(
  id: string,
  data: {
    codigo: string;
    nome: string;
    cnpj?: string | null;
    site?: string | null;
    ativo: boolean;
  },
) {
  return staffJson<CadastroBanco>(`/v2/cadastros/bancos/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}
