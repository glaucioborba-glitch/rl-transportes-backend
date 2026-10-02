import { ApiError, nestErrorMessage, staffJson, staffRequest } from "@/lib/api/staff-client";

export type CadastroTabelaServico = {
  id: string;
  nome: string;
  descricao: string | null;
  dataInicio: string;
  dataFim: string | null;
  ativo: boolean;
  padrao: boolean;
  qtdItens: number;
};

export type ServicoEfeito = "NENHUM" | "SUBSTITUIR_LACRE_SAIDA" | "TRANSBORDO_CARGA";

export type CadastroServicoItem = {
  id: string;
  tabelaId: string;
  codigo: string;
  nome: string;
  valor: number;
  unidade: string;
  ativo: boolean;
  efeito?: ServicoEfeito;
  servicoLacreTerminalCodigo?: string;
  observacaoRic?: string;
};

export type ServicoItemPayload = {
  codigo: string;
  nome: string;
  valor: number;
  unidade: string;
  ativo: boolean;
  efeito: ServicoEfeito;
  servicoLacreTerminalCodigo?: string;
  observacaoRic?: string;
};

export function listCadastrosTabelasServicos() {
  return staffJson<{ items: CadastroTabelaServico[]; total: number }>("/v2/cadastros/tabelas-servicos");
}

export function getCadastroTabelaServico(id: string) {
  return staffJson<CadastroTabelaServico>(`/v2/cadastros/tabelas-servicos/${encodeURIComponent(id)}`);
}

export function createCadastroTabelaServico(data: {
  nome: string;
  descricao?: string;
  dataInicio?: string;
  dataFim?: string;
  ativo: boolean;
  padrao: boolean;
}) {
  return staffJson<CadastroTabelaServico>("/v2/cadastros/tabelas-servicos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function updateCadastroTabelaServico(
  id: string,
  data: {
    nome: string;
    descricao?: string;
    dataInicio?: string;
    dataFim?: string;
    ativo: boolean;
    padrao: boolean;
  },
) {
  return staffJson<CadastroTabelaServico>(`/v2/cadastros/tabelas-servicos/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function listCadastroServicoItens(tabelaId: string) {
  return staffJson<{ items: CadastroServicoItem[]; total: number }>(
    `/v2/cadastros/tabelas-servicos/${encodeURIComponent(tabelaId)}/itens`,
  );
}

export function createCadastroServicoItem(tabelaId: string, data: ServicoItemPayload) {
  return staffJson<CadastroServicoItem>(
    `/v2/cadastros/tabelas-servicos/${encodeURIComponent(tabelaId)}/itens`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );
}

export function updateCadastroServicoItem(
  tabelaId: string,
  itemId: string,
  data: ServicoItemPayload,
) {
  return staffJson<CadastroServicoItem>(
    `/v2/cadastros/tabelas-servicos/${encodeURIComponent(tabelaId)}/itens/${encodeURIComponent(itemId)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );
}

export function listCatalogoServicosAtivos(unidadeProcessoId?: string) {
  const qs = unidadeProcessoId
    ? `?unidadeProcessoId=${encodeURIComponent(unidadeProcessoId)}`
    : "";
  return staffJson<{ tabelaId: string | null; items: CadastroServicoItem[] }>(
    `/v2/unidade-processos/catalogo-servicos${qs}`,
  );
}

export type UnidadeProcessoServicoLancado = {
  id: string;
  codigo: string;
  nome: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  createdAt: string;
  payload?: {
    automatico?: boolean;
    origem?: string;
    cobranca?: string;
    excluido?: boolean;
    exclusao?: {
      motivo?: string;
      anexoNome?: string;
      em?: string;
      gerenteEmail?: string;
    };
  } | null;
};

export function listUnidadeProcessoServicos(id: string) {
  return staffJson<{ items: UnidadeProcessoServicoLancado[] }>(
    `/v2/unidade-processos/${encodeURIComponent(id)}/servicos`,
  );
}

export function lancarUnidadeProcessoServico(
  id: string,
  data: {
    servicoItemId: string;
    quantidade: number;
    lacre?: string;
    origemLacre?: string;
    isoDestino?: string;
  },
) {
  return staffJson(`/v2/unidade-processos/${encodeURIComponent(id)}/servicos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function removerUnidadeProcessoServico(id: string, lancamentoId: string) {
  return staffJson(`/v2/unidade-processos/${encodeURIComponent(id)}/servicos/${encodeURIComponent(lancamentoId)}`, {
    method: "DELETE",
  });
}

export function excluirHandlingAutomatico(
  id: string,
  lancamentoId: string,
  data: { motivo: string; documento: string; password: string; anexo?: File | null },
) {
  const form = new FormData();
  form.append("motivo", data.motivo);
  form.append("documento", data.documento);
  form.append("password", data.password);
  if (data.anexo) form.append("anexo", data.anexo);
  return staffJson<{ ok: boolean; excluido: boolean }>(
    `/v2/unidade-processos/${encodeURIComponent(id)}/servicos/${encodeURIComponent(lancamentoId)}/excluir-automatico`,
    { method: "POST", body: form },
  );
}

export async function abrirAnexoExclusaoHandling(id: string, lancamentoId: string) {
  const res = await staffRequest(
    `/v2/unidade-processos/${encodeURIComponent(id)}/servicos/${encodeURIComponent(lancamentoId)}/anexo`,
    { headers: { Accept: "*/*" } },
  );
  if (!res.ok) {
    const err = await res.text();
    throw new ApiError(nestErrorMessage(err, res.status), res.status);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
