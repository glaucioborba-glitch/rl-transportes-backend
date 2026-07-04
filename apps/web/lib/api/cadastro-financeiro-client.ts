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

// TODO FASE 02: Substituir opções fixas por tabela CondicaoPagamentoPersonalizada

export async function listarCadastrosPendentes(): Promise<CadastroPendenteRow[]> {
  return staffJson<CadastroPendenteRow[]>("/financeiro/cadastros-pendentes");
}

export async function fetchPendenciasCadastroCount(): Promise<number> {
  const res = await staffJson<{ count: number }>("/financeiro/pendencias-count");
  return typeof res.count === "number" ? res.count : 0;
}

export async function aprovarCadastroFinanceiro(id: string, condicaoPagamento: string) {
  const apiValue = toCondicaoPagamentoApiValue(condicaoPagamento);
  return staffJson(`/financeiro/cadastros-pendentes/${encodeURIComponent(id)}/aprovar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ condicaoPagamento: apiValue }),
  });
}

export async function rejeitarCadastroFinanceiro(id: string, motivo: string) {
  return staffJson(`/financeiro/cadastros-pendentes/${encodeURIComponent(id)}/rejeitar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ motivo }),
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
