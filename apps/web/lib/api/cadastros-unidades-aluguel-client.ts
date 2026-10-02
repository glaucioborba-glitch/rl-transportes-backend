import { staffJson } from "@/lib/api/staff-client";

export type UnidadeAluguelStatus = "DISPONIVEL" | "ALUGADA" | "MANUTENCAO" | "USO_PROPRIO" | "INATIVA";

export type CadastroUnidadeAluguel = {
  id: string;
  unidadeIso: string;
  tipoContainerCodigo: string;
  containerTamanho: string;
  capacidadeCodigo: string | null;
  status: UnidadeAluguelStatus;
  observacao: string | null;
  aluguelAtivo: {
    id: string;
    clienteNome: string;
    unidadeProcessoId: string;
    numero: number;
  } | null;
};

export type UnidadeAluguelPayload = {
  unidadeIso: string;
  tipoContainerCodigo: string;
  containerTamanho: string;
  capacidadeCodigo?: string;
  status?: UnidadeAluguelStatus;
  observacao?: string;
};

export function listCadastrosUnidadesAluguel(status?: string) {
  const q = status && status !== "todos" ? `?status=${encodeURIComponent(status)}` : "";
  return staffJson<{ items: CadastroUnidadeAluguel[]; total: number }>(
    `/v2/cadastros/unidades-aluguel${q}`,
  );
}

export function getCadastroUnidadeAluguel(id: string) {
  return staffJson<CadastroUnidadeAluguel>(`/v2/cadastros/unidades-aluguel/${encodeURIComponent(id)}`);
}

export function createCadastroUnidadeAluguel(data: UnidadeAluguelPayload) {
  return staffJson<CadastroUnidadeAluguel>("/v2/cadastros/unidades-aluguel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function updateCadastroUnidadeAluguel(id: string, data: UnidadeAluguelPayload) {
  return staffJson<CadastroUnidadeAluguel>(`/v2/cadastros/unidades-aluguel/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}
