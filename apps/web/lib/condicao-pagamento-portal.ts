/** Opções de condição de pagamento (fallback offline). */
export const OPCOES_CONDICAO_PAGAMENTO = [
  { label: "Faturamento", value: "FATURAMENTO" },
  { label: "À Vista PIX", value: "AVISTA_PIX" },
] as const;

export type CondicaoPagamentoOption = { label: string; value: string };

export async function fetchCondicoesPagamento(apiBase: string, token: string) {
  const res = await fetch(`${apiBase}/financeiro/cadastros-pendentes/condicoes-pagamento`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [...OPCOES_CONDICAO_PAGAMENTO];
  return (await res.json()) as CondicaoPagamentoOption[];
}

/** @deprecated Use OPCOES_CONDICAO_PAGAMENTO */
export const CONDICOES_PAGAMENTO_CADASTRO = OPCOES_CONDICAO_PAGAMENTO;

export type CondicaoPagamentoCadastroValue = string;

export const CONDICAO_PAGAMENTO_PADRAO_VALUE = "FATURAMENTO";

function valuesFrom(opcoes: CondicaoPagamentoOption[]): Set<string> {
  return new Set(opcoes.map((o) => o.value));
}

/** Garante payload API — aceita value ou label legado do dropdown. */
export function toCondicaoPagamentoApiValue(
  raw: string,
  opcoes: CondicaoPagamentoOption[] = [...OPCOES_CONDICAO_PAGAMENTO],
): string {
  const trimmed = raw.trim();
  const apiValues = valuesFrom(opcoes);
  if (apiValues.has(trimmed)) return trimmed;
  const byLabel = opcoes.find((o) => o.label === trimmed);
  if (byLabel) return byLabel.value;
  return opcoes[0]?.value ?? CONDICAO_PAGAMENTO_PADRAO_VALUE;
}

export function isCondicaoPagamentoApiValue(
  raw: string,
  opcoes: CondicaoPagamentoOption[] = [...OPCOES_CONDICAO_PAGAMENTO],
): boolean {
  return valuesFrom(opcoes).has(raw);
}

const LABELS: Record<string, string> = {
  FATURAMENTO: "Faturamento",
  AVISTA_PIX: "À Vista PIX",
  FATURAMENTO_PIX: "Faturamento / À Vista PIX",
  BOLETO_7DIAS: "Boleto 7 dias",
  BOLETO_30DIAS: "Boleto 30 dias",
  PIX: "PIX à vista",
};

export function labelCondicaoPagamento(
  value: string | null | undefined,
  opcoes?: CondicaoPagamentoOption[],
): string {
  if (!value) return "—";
  const fromApi = opcoes?.find((o) => o.value === value)?.label;
  return fromApi ?? LABELS[value] ?? value;
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
