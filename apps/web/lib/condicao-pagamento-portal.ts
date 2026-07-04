/** Opções fixas da análise financeira (fase 01). */
export const OPCOES_CONDICAO_PAGAMENTO = [
  { label: "Faturamento", value: "FATURAMENTO" },
  { label: "À Vista PIX", value: "AVISTA_PIX" },
] as const;

/** @deprecated Use OPCOES_CONDICAO_PAGAMENTO */
export const CONDICOES_PAGAMENTO_CADASTRO = OPCOES_CONDICAO_PAGAMENTO;

export type CondicaoPagamentoCadastroValue = (typeof OPCOES_CONDICAO_PAGAMENTO)[number]["value"];

export const CONDICAO_PAGAMENTO_PADRAO_VALUE: CondicaoPagamentoCadastroValue = "FATURAMENTO";

const API_VALUES = new Set<string>(OPCOES_CONDICAO_PAGAMENTO.map((o) => o.value));

/** Garante payload API — aceita value ou label legado do dropdown. */
export function toCondicaoPagamentoApiValue(raw: string): CondicaoPagamentoCadastroValue {
  const trimmed = raw.trim();
  if (API_VALUES.has(trimmed)) return trimmed as CondicaoPagamentoCadastroValue;
  const byLabel = OPCOES_CONDICAO_PAGAMENTO.find((o) => o.label === trimmed);
  if (byLabel) return byLabel.value;
  return CONDICAO_PAGAMENTO_PADRAO_VALUE;
}

export function isCondicaoPagamentoApiValue(raw: string): raw is CondicaoPagamentoCadastroValue {
  return API_VALUES.has(raw);
}

// TODO FASE 02: Substituir opções fixas por tabela CondicaoPagamentoPersonalizada

const LABELS: Record<string, string> = {
  FATURAMENTO: "Faturamento",
  AVISTA_PIX: "À Vista PIX",
  /** Legado — cadastros aprovados antes da divisão em 2 opções. */
  FATURAMENTO_PIX: "Faturamento / À Vista PIX",
  BOLETO_7DIAS: "Boleto 7 dias",
  BOLETO_30DIAS: "Boleto 30 dias",
  PIX: "PIX à vista",
};

export function labelCondicaoPagamento(value: string | null | undefined): string {
  if (!value) return "—";
  return LABELS[value] ?? value;
}

export function descricaoCondicaoPagamento(value: string | null | undefined): string | null {
  if (value === "AVISTA_PIX" || value === "PIX" || value === "FATURAMENTO_PIX") {
    return "Pagamento via PIX à vista";
  }
  if (value === "FATURAMENTO") {
    return "Faturamento conforme condições contratuais";
  }
  return null;
}
