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
  status: "DISPONIVEL" | "ALUGADA" | "MANUTENCAO" | "USO_PROPRIO" | "INATIVA";
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
  solicitacaoAluguelId?: string;
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

export type StaffSolicitacaoAluguel = {
  id: string;
  protocolo: string;
  clienteId: string;
  empresa: string | null;
  quantidade: number;
  finalidade: "RETIRADA_USO_EXTERNO" | "UTILIZACAO_PATIO_FL";
  dataColeta: string | null;
  dataPrevistaDevolucao: string | null;
  status: "PENDENTE" | "APROVADO" | "REJEITADO" | "INICIADO" | "ENCERRADO";
  motivoRejeicao: string | null;
  createdAt: string;
  updatedAt: string;
  autorizadoEm: string | null;
  iniciados?: number;
  contrato?: {
    unidadeIso: string | null;
    numero: number | null;
    idLabel: string | null;
    status: "ATIVO" | "ENCERRADO";
  } | null;
};

export type MotivoRejeicaoAluguel = {
  id: string;
  codigo: string;
  descricao: string;
  exigeObservacao: boolean;
};

export function staffListarMotivosRejeicaoAluguel() {
  return staffJson<{ items: MotivoRejeicaoAluguel[]; total: number }>("/v2/alugueis/motivos-rejeicao");
}

export function staffListarReservasAluguel() {
  return staffJson<{ items: StaffSolicitacaoAluguel[]; total: number }>("/v2/alugueis/reservas");
}

export function staffListarSolicitacoesAluguel(status?: string) {
  const q = status ? `?status=${encodeURIComponent(status)}` : "";
  return staffJson<{ items: StaffSolicitacaoAluguel[]; total: number }>(`/v2/alugueis/solicitacoes${q}`);
}

export function staffObterSolicitacaoAluguel(id: string) {
  return staffJson<StaffSolicitacaoAluguel>(`/v2/alugueis/solicitacoes/${encodeURIComponent(id)}`);
}

export function staffAprovarSolicitacaoAluguel(id: string) {
  return staffJson<StaffSolicitacaoAluguel>(`/v2/alugueis/solicitacoes/${encodeURIComponent(id)}/aprovar`, {
    method: "POST",
  });
}

export function staffRejeitarSolicitacaoAluguel(id: string, motivo: string) {
  return staffJson<StaffSolicitacaoAluguel>(`/v2/alugueis/solicitacoes/${encodeURIComponent(id)}/rejeitar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ motivo }),
  });
}
