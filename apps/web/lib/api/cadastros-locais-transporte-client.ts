import { staffJson } from "@/lib/api/staff-client";

export const TIPOS_LOCAL_TRANSPORTE = [
  { value: "TERMINAL", label: "Terminal / pátio" },
  { value: "PORTO", label: "Porto" },
  { value: "DEPOSITO", label: "Depósito" },
  { value: "CIDADE", label: "Cidade" },
  { value: "OUTRO", label: "Outro" },
] as const;

export type CadastroLocalTransporte = {
  id: string;
  codigo: string;
  nome: string;
  tipo: string;
  cidade: string | null;
  uf: string | null;
  ativo: boolean;
};

export function labelTipoLocalTransporte(tipo: string) {
  return TIPOS_LOCAL_TRANSPORTE.find((t) => t.value === tipo)?.label ?? tipo;
}

export async function listCadastrosLocaisTransporte(search?: string) {
  const qs = search?.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
  return staffJson<{ items: CadastroLocalTransporte[]; total: number }>(
    `/v2/cadastros/locais-transporte${qs}`,
  );
}

export async function getCadastroLocalTransporte(id: string) {
  return staffJson<CadastroLocalTransporte>(
    `/v2/cadastros/locais-transporte/${encodeURIComponent(id)}`,
  );
}

export async function createCadastroLocalTransporte(
  data: Omit<CadastroLocalTransporte, "id">,
) {
  return staffJson<CadastroLocalTransporte>("/v2/cadastros/locais-transporte", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function updateCadastroLocalTransporte(
  id: string,
  data: Omit<CadastroLocalTransporte, "id">,
) {
  return staffJson<CadastroLocalTransporte>(
    `/v2/cadastros/locais-transporte/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );
}
