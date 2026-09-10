import { staffJson } from "@/lib/api/staff-client";

export type AluguelContrato = {
  id: string;
  status: "ATIVO" | "ENCERRADO" | "CANCELADO";
  iniciadoEm: string;
  encerradoEm: string | null;
  observacao: string | null;
  unidadeIso: string;
  tipoContainerCodigo: string;
  containerTamanho: string;
  clienteId: string;
  clienteNome: string;
  tabelaNome: string;
  unidadeProcessoId: string;
  numero: number;
  idLabel: string;
};

export type AluguelFrotaItem = {
  id: string;
  unidadeIso: string;
  tipoContainerCodigo: string;
  containerTamanho: string;
  status: "DISPONIVEL" | "ALUGADA" | "MANUTENCAO" | "INATIVA";
  aluguelAtivo: {
    id: string;
    clienteNome: string;
    unidadeProcessoId: string;
    numero: number;
  } | null;
};

export function listAlugueis(status?: string) {
  const q = status ? `?status=${encodeURIComponent(status)}` : "";
  return staffJson<{ items: AluguelContrato[]; total: number }>(`/v2/alugueis${q}`);
}

export function listAlugueisFrota() {
  return staffJson<{ items: AluguelFrotaItem[]; total: number }>("/v2/alugueis/frota");
}

export function listAlugueisClientes() {
  return staffJson<{ items: Array<{ id: string; razaoSocial: string; nomeFantasia: string | null }> }>(
    "/v2/alugueis/clientes",
  );
}

export function iniciarAluguel(data: {
  unidadeAluguelId: string;
  clienteId: string;
  tabelaAluguelId?: string;
  observacao?: string;
}) {
  return staffJson<{ id: string; numero: number; unidadeProcessoId: string; unidadeIso: string }>(
    "/v2/alugueis",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );
}

export function devolverAluguel(id: string) {
  return staffJson<{ id: string; numero: number; encerradoEm: string }>(
    `/v2/alugueis/${encodeURIComponent(id)}/devolver`,
    { method: "POST" },
  );
}
