import { staffJson } from "./staff-client";

export type FaturamentoModo = "MANUAL" | "AUTOMATICO";
export type StatusFaturaPacote = "RASCUNHO" | "EMITINDO" | "ENVIADA" | "CANCELADA";

export type FaturaComposicaoLinha = {
  id: string;
  descricao: string;
  detalheCobranca?: string | null;
  evento: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
};

export type FaturaIdFila = {
  faturaId: string;
  idLabel: string;
  unidadeProcessoId: string | null;
  modalidade: string;
  unidadeIso: string;
  processo: string;
  booking: string;
  diasCobrados: number;
  entradaEm: string | null;
  encerradoEm: string;
  valorTotal: number;
  composicao: FaturaComposicaoLinha[];
};

export type FaturaFilaCliente = {
  id: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  cpfCnpj: string;
  condicaoPagamento: string | null;
  prazoPagamento: string | null;
  faturamentoModo: FaturamentoModo;
  faturamentoHora: string | null;
  ids: FaturaIdFila[];
  total: number;
};

export type FaturaPacoteEnviada = {
  id: string;
  numero: string;
  clienteId: string;
  clienteNome: string;
  status: StatusFaturaPacote;
  modo: FaturamentoModo;
  valorTotal: number;
  dataEmissao: string | null;
  agendadoPara: string | null;
  linkNfse: string | null;
  linkBoleto: string | null;
  linkPix: string | null;
};

export type FaturaFilaResponse = {
  clientes: FaturaFilaCliente[];
  enviadas: FaturaPacoteEnviada[];
};

export type FaturaClienteDetalhe = {
  cliente: Omit<FaturaFilaCliente, "ids" | "total">;
  ids: FaturaIdFila[];
  total: number;
};

export type FaturaPacoteDetalhe = {
  id: string;
  numero: string;
  status: StatusFaturaPacote;
  modo: FaturamentoModo;
  valorTotal: number;
  dataEmissao: string | null;
  agendadoPara: string | null;
  dataVencimento: string | null;
  linkNfse: string | null;
  linkBoleto: string | null;
  linkPix: string | null;
  processamentoErro: string | null;
  cliente: Omit<FaturaFilaCliente, "ids" | "total">;
  ids: FaturaIdFila[];
};

export async function listarFilaFaturas() {
  return staffJson<FaturaFilaResponse>("/financeiro/faturas");
}

export async function obterFilaFaturasCliente(clienteId: string) {
  return staffJson<FaturaClienteDetalhe>(
    `/financeiro/faturas/clientes/${encodeURIComponent(clienteId)}`,
  );
}

export async function obterFaturaPacote(id: string) {
  return staffJson<FaturaPacoteDetalhe>(`/financeiro/faturas/pacotes/${encodeURIComponent(id)}`);
}

export async function emitirFaturaPacote(clienteId: string, faturaIds: string[]) {
  return staffJson<{ id: string; numero: string; valorTotal: number; status: StatusFaturaPacote }>(
    `/financeiro/faturas/clientes/${encodeURIComponent(clienteId)}/emitir`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ faturaIds }),
    },
  );
}

export async function agendarFaturaPacote(
  clienteId: string,
  faturaIds: string[],
  agendadoPara: string,
) {
  return staffJson<{
    id: string;
    numero: string;
    valorTotal: number;
    status: StatusFaturaPacote;
    agendadoPara: string;
  }>(`/financeiro/faturas/clientes/${encodeURIComponent(clienteId)}/agendar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ faturaIds, agendadoPara }),
  });
}
