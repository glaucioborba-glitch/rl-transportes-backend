import { staffJson } from "./staff-client";
import {
  CONDICAO_PAGAMENTO_PADRAO_VALUE,
  toCondicaoPagamentoApiValue,
  type CondicaoPagamentoCadastroValue,
} from "@/lib/condicao-pagamento-portal";

export type ValidacaoDominio = "APROVADO" | "DIVERGENTE" | "INDISPONIVEL";
export type StatusCadastroCliente = "PENDENTE_ANALISE_FINANCEIRA" | "APROVADO" | "REJEITADO";

export type CadastroPendenteRow = {
  id: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  cpfCnpj: string;
  email: string;
  validacaoDominio: ValidacaoDominio;
  statusCadastro: StatusCadastroCliente;
  createdAt: string;
  inscricaoEstadual: string | null;
  inscricaoMunicipal: string | null;
  isentoIE: boolean;
  enderecoLogradouro: string;
  enderecoNumero: string;
  enderecoComplemento: string | null;
  enderecoBairro: string;
  enderecoCidade: string;
  enderecoUf: string;
  enderecoCep: string;
};

export type CondicaoPagamentoAprovacao = CondicaoPagamentoCadastroValue;

export { CONDICAO_PAGAMENTO_PADRAO_VALUE as CONDICAO_PAGAMENTO_PADRAO };

// Condições de pagamento carregadas da API do tenant (dinâmico)

export async function listarCadastrosPendentes(): Promise<CadastroPendenteRow[]> {
  return staffJson<CadastroPendenteRow[]>("/financeiro/cadastros-pendentes");
}

export async function fetchPendenciasCadastroCount(): Promise<number> {
  const res = await staffJson<{ count: number }>("/financeiro/pendencias-count");
  return typeof res.count === "number" ? res.count : 0;
}

export async function listarCondicoesPagamento(): Promise<
  Array<{
    label: string;
    value: string;
    dias?: number | null;
    vencimentos?: number[];
    formaVinculada?: string | null;
  }>
> {
  return staffJson("/financeiro/cadastros-pendentes/condicoes-pagamento");
}

export async function listarPrazosPagamento(): Promise<
  Array<{
    label: string;
    value: string;
    dias?: number | null;
    vencimentos?: number[];
    formaVinculada?: string | null;
  }>
> {
  return staffJson("/financeiro/cadastros-pendentes/prazos-pagamento");
}

export async function aprovarCadastroFinanceiro(
  id: string,
  condicaoPagamento: string,
  prazoPagamento: string,
) {
  const apiValue = toCondicaoPagamentoApiValue(condicaoPagamento);
  return staffJson(`/financeiro/cadastros-pendentes/${encodeURIComponent(id)}/aprovar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ condicaoPagamento: apiValue, prazoPagamento }),
  });
}

export async function rejeitarCadastroFinanceiro(id: string, motivo: string) {
  return staffJson(`/financeiro/cadastros-pendentes/${encodeURIComponent(id)}/rejeitar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ motivo }),
  });
}

export type ClienteCondicaoRow = {
  id: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  cpfCnpj: string;
  condicaoPagamento: string | null;
  prazoPagamento: string | null;
  analisadoEm: string | null;
  cadastroTabelaPrecoId: string | null;
  cadastroTabelaTransporteId: string | null;
  cadastroTabelaServicoId: string | null;
  cadastroTabelaAluguelId: string | null;
  faturamentoModo: "MANUAL" | "AUTOMATICO";
  faturamentoHora: string | null;
};

export type TabelaPrecoAtribuicao = {
  id: string;
  nome: string;
  padrao: boolean;
  billingTabelaPrecoId: string | null;
};

export async function listarClientesCondicoes(q?: string): Promise<ClienteCondicaoRow[]> {
  const qs = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
  return staffJson<ClienteCondicaoRow[]>(`/financeiro/clientes-condicoes${qs}`);
}

export async function listarTabelasPrecoAtribuicao() {
  return staffJson<TabelaPrecoAtribuicao[]>("/financeiro/clientes-condicoes/tabelas-precos");
}

export type TabelaTransporteAtribuicao = {
  id: string;
  nome: string;
  padrao: boolean;
};

export async function listarTabelasTransporteAtribuicao() {
  return staffJson<TabelaTransporteAtribuicao[]>("/financeiro/clientes-condicoes/tabelas-transporte");
}

export type TabelaServicoAtribuicao = {
  id: string;
  nome: string;
  padrao: boolean;
};

export async function listarTabelasServicoAtribuicao() {
  return staffJson<TabelaServicoAtribuicao[]>("/financeiro/clientes-condicoes/tabelas-servicos");
}

export type TabelaAluguelAtribuicao = {
  id: string;
  nome: string;
  padrao: boolean;
};

export async function listarTabelasAluguelAtribuicao() {
  return staffJson<TabelaAluguelAtribuicao[]>("/financeiro/clientes-condicoes/tabelas-aluguel");
}

export async function atualizarClienteCondicao(
  id: string,
  body: {
    condicaoPagamento: string;
    prazoPagamento: string;
    cadastroTabelaPrecoId?: string;
    cadastroTabelaTransporteId?: string;
    cadastroTabelaServicoId?: string;
    cadastroTabelaAluguelId?: string;
    faturamentoModo?: "MANUAL" | "AUTOMATICO";
    faturamentoHora?: string;
  },
) {
  return staffJson(`/financeiro/clientes-condicoes/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function validacaoDominioBadge(validacao: ValidacaoDominio): string {
  if (validacao === "APROVADO") return "🟢 Aprovado";
  if (validacao === "DIVERGENTE") return "🟡 Divergente";
  return "⚪ Indisponível";
}

export function displayInscricaoEstadual(row: Pick<CadastroPendenteRow, "inscricaoEstadual" | "isentoIE">): string {
  if (row.isentoIE) return "Isento";
  const ie = row.inscricaoEstadual?.trim();
  return ie || "—";
}

export function displayField(value: string | null | undefined): string {
  const v = value?.trim();
  return v || "—";
}

export function formatEnderecoLinha(
  row: Pick<
    CadastroPendenteRow,
    "enderecoLogradouro" | "enderecoNumero" | "enderecoComplemento" | "enderecoBairro"
  >,
): string {
  const rua = [row.enderecoLogradouro?.trim(), row.enderecoNumero?.trim()].filter(Boolean).join(", ");
  const bairro = row.enderecoBairro?.trim();
  if (rua && bairro) return `${rua} — ${bairro}`;
  return rua || bairro || "—";
}
