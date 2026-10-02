import { staffJson } from "@/lib/api/staff-client";

export type CadastroTabelaAluguel = {
  id: string;
  nome: string;
  descricao: string | null;
  dataInicio: string;
  dataFim: string | null;
  ativo: boolean;
  padrao: boolean;
  qtdItens: number;
};

export type CadastroTabelaAluguelItem = {
  id: string;
  tabelaId: string;
  tipoContainerCodigo: string;
  containerTamanho: string;
  valorDiaria: number;
  diasFreeTime: number;
  valorHandling: number;
  faixasDiaria: { diaInicio: number; diaFim: number | null; valorDiaria: number }[];
  ativo: boolean;
};

export type TabelaAluguelPayload = {
  nome: string;
  descricao?: string;
  dataInicio?: string;
  dataFim?: string;
  ativo: boolean;
  padrao: boolean;
  itens?: TabelaAluguelItemPayload[];
};

export type TabelaAluguelItemPayload = {
  tipoContainerCodigo: string;
  containerTamanho: string;
  valorDiaria?: number;
  diasFreeTime: number;
  valorHandling: number;
  faixasDiaria?: { diaInicio: number; diaFim: number | null; valorDiaria: number }[];
  ativo: boolean;
};

export function listCadastrosTabelasAluguel() {
  return staffJson<{ items: CadastroTabelaAluguel[]; total: number }>("/v2/cadastros/tabelas-aluguel");
}

export function getCadastroTabelaAluguel(id: string) {
  return staffJson<CadastroTabelaAluguel>(`/v2/cadastros/tabelas-aluguel/${encodeURIComponent(id)}`);
}

export function createCadastroTabelaAluguel(data: TabelaAluguelPayload) {
  return staffJson<CadastroTabelaAluguel>("/v2/cadastros/tabelas-aluguel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function updateCadastroTabelaAluguel(id: string, data: TabelaAluguelPayload) {
  return staffJson<CadastroTabelaAluguel>(`/v2/cadastros/tabelas-aluguel/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function listCadastroTabelaAluguelItens(tabelaId: string) {
  return staffJson<{ items: CadastroTabelaAluguelItem[]; total: number }>(
    `/v2/cadastros/tabelas-aluguel/${encodeURIComponent(tabelaId)}/itens`,
  );
}

export function createCadastroTabelaAluguelItem(tabelaId: string, data: TabelaAluguelItemPayload) {
  return staffJson<CadastroTabelaAluguelItem>(
    `/v2/cadastros/tabelas-aluguel/${encodeURIComponent(tabelaId)}/itens`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );
}

export function updateCadastroTabelaAluguelItem(
  tabelaId: string,
  itemId: string,
  data: TabelaAluguelItemPayload,
) {
  return staffJson<CadastroTabelaAluguelItem>(
    `/v2/cadastros/tabelas-aluguel/${encodeURIComponent(tabelaId)}/itens/${encodeURIComponent(itemId)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );
}
