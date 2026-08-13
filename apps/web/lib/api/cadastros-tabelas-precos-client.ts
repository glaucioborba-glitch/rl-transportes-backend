import { staffJson } from "@/lib/api/staff-client";

export type FaixaDiaria = {
  diaInicio: number;
  diaFim: number | null;
  valorDiaria: number;
};

export type CadastroTabelaPrecoItem = {
  id?: string;
  categoriaItem?: "OPERACAO" | "ARMAZENAGEM";
  tipoOperacaoCodigo: string;
  tipoContainerCodigo: string;
  capacidadeCodigo?: string;
  containerTamanho: string;
  valor: number | string;
  unidade: string;
  valorMinimo?: number | string;
  statusContainer?: "CHEIO" | "VAZIO" | "AMBOS";
  valorHandling?: number | null;
  freeTimeDias?: number | null;
  faixasDiaria?: FaixaDiaria[];
  tarifaDiariaArmazenagem?: number | null;
  tarifaEnergiaReeferDiaria?: number | null;
};

export type CadastroTabelaPreco = {
  id: string;
  nome: string;
  descricao?: string | null;
  moeda: string;
  dataInicio: string;
  dataFim?: string | null;
  ativo: boolean;
  padrao?: boolean;
  syncedAt?: string | null;
  billingTabelaPrecoId?: string | null;
  clienteId?: string;
  cliente?: { id: string; nome: string } | null;
  itensCount?: number;
};

export async function listCadastrosTabelasPrecos() {
  return staffJson<{ items: CadastroTabelaPreco[]; total: number }>(
    "/v2/cadastros/tabelas-precos",
  );
}

export async function getCadastroTabelaPreco(id: string) {
  return staffJson<
    CadastroTabelaPreco & {
      descricao: string;
      clienteId: string;
      dataFim: string;
      padrao: boolean;
      syncedAt: string | null;
      billingTabelaPrecoId: string | null;
    }
  >(`/v2/cadastros/tabelas-precos/${encodeURIComponent(id)}`);
}

export async function listCadastroTabelaPrecoItens(id: string) {
  return staffJson<{ items: CadastroTabelaPrecoItem[]; total: number }>(
    `/v2/cadastros/tabelas-precos/${encodeURIComponent(id)}/itens`,
  );
}

export async function gerarMatrizCombinacoes() {
  return staffJson<{ items: CadastroTabelaPrecoItem[]; total: number }>(
    "/v2/cadastros/tabelas-precos/matriz/combinacoes",
  );
}

export async function syncCadastroTabelaPreco(id: string) {
  return staffJson<{ billingTabelaPrecoId: string; regrasCount: number }>(
    `/v2/cadastros/tabelas-precos/${encodeURIComponent(id)}/sync`,
    { method: "POST" },
  );
}

export type CadastroTabelaPrecoItemInput = {
  categoriaItem?: "OPERACAO" | "ARMAZENAGEM";
  tipoOperacaoCodigo: string;
  tipoContainerCodigo?: string;
  capacidadeCodigo?: string;
  containerTamanho?: string;
  valor?: number;
  unidade?: string;
  valorMinimo?: number;
  statusContainer?: "CHEIO" | "VAZIO" | "AMBOS";
  valorHandling?: number;
  freeTimeDias?: number;
  faixasDiaria?: FaixaDiaria[];
  tarifaDiariaArmazenagem?: number;
  tarifaEnergiaReeferDiaria?: number;
};

export async function createCadastroTabelaPreco(data: {
  nome: string;
  descricao?: string;
  clienteId?: string;
  moeda?: string;
  dataInicio?: string;
  dataFim?: string;
  ativo?: boolean;
  padrao?: boolean;
  itens: CadastroTabelaPrecoItemInput[];
}) {
  return staffJson<CadastroTabelaPreco>("/v2/cadastros/tabelas-precos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function updateCadastroTabelaPreco(
  id: string,
  data: {
    nome: string;
    descricao?: string;
    clienteId?: string;
    moeda?: string;
    dataInicio?: string;
    dataFim?: string;
    ativo?: boolean;
    padrao?: boolean;
    itens: CadastroTabelaPrecoItemInput[];
  },
) {
  return staffJson<CadastroTabelaPreco>(`/v2/cadastros/tabelas-precos/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}
