/** Opções de condição de pagamento (fallback offline). */
export const OPCOES_CONDICAO_PAGAMENTO = [
  { label: "Faturamento", value: "FATURAMENTO" },
  { label: "À Vista PIX", value: "AVISTA_PIX" },
] as const;

export type CondicaoPagamentoOption = {
  label: string;
  value: string;
  dias?: number | null;
  vencimentos?: number[];
  formaVinculada?: string | null;
};

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

export const PRAZOS_PAGAMENTO = [
  { label: "À vista", value: "A_VISTA", dias: 0, vencimentos: [0], formaVinculada: "AVISTA_PIX" },
  { label: "30 dias", value: "30_DIAS", dias: 30, vencimentos: [30], formaVinculada: "FATURAMENTO" },
  { label: "30/60 dias", value: "30_60", dias: 30, vencimentos: [30, 60], formaVinculada: "FATURAMENTO" },
  { label: "30/60/90 dias", value: "30_60_90", dias: 30, vencimentos: [30, 60, 90], formaVinculada: "FATURAMENTO" },
  { label: "Personalizado", value: "PERSONALIZADO", dias: 30, vencimentos: [30], formaVinculada: "FATURAMENTO" },
] as const;

export function labelPrazoPagamento(
  value: string | null | undefined,
  opcoes?: CondicaoPagamentoOption[],
): string {
  if (!value) return "—";
  const fromApi = opcoes?.find((o) => o.value === value)?.label;
  return fromApi ?? PRAZOS_PAGAMENTO.find((o) => o.value === value)?.label ?? value;
}

export function mergeValorOption(
  opcoes: CondicaoPagamentoOption[],
  saved: string | null | undefined,
): CondicaoPagamentoOption[] {
  const value = saved?.trim();
  if (!value || opcoes.some((o) => o.value === value)) return opcoes;
  return [...opcoes, { label: value, value }];
}

const LEGACY_PRAZO = new Set<string>(PRAZOS_PAGAMENTO.map((p) => p.value));

/** Se o prazo veio vazio e a forma guardou um código de prazo antigo, separa os dois campos. */
export function splitFormaPrazoSalvos(
  forma: string | null | undefined,
  prazo: string | null | undefined,
  prazos: CondicaoPagamentoOption[] = [...PRAZOS_PAGAMENTO],
): { forma: string; prazo: string } {
  const formaNorm = forma?.trim() ?? "";
  const prazoNorm = prazo?.trim() ?? "";
  if (prazoNorm) return { forma: formaNorm, prazo: prazoNorm };
  if (prazos.some((p) => p.value === formaNorm) || LEGACY_PRAZO.has(formaNorm)) {
    const vinculo = prazos.find((p) => p.value === formaNorm)?.formaVinculada ?? "";
    return { forma: vinculo, prazo: formaNorm };
  }
  return { forma: formaNorm, prazo: "" };
}

/** Prazos cuja forma vinculada bate com a forma escolhida (cadastro financeiro). */
export function prazosDaForma<T extends { formaVinculada?: string | null }>(
  prazos: T[],
  forma: string,
): T[] {
  const formaNorm = forma.trim();
  if (!formaNorm || !prazos.length) return prazos;
  const vinculados = prazos.filter((p) => (p.formaVinculada ?? "").trim() === formaNorm);
  if (vinculados.length) return vinculados;
  const semVinculo = prazos.filter((p) => !(p.formaVinculada ?? "").trim());
  return semVinculo.length ? semVinculo : prazos;
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

/** Layout de faturamento (FAT + boleto). PIX à vista não mostra boleto. */
export function isLayoutFaturamentoPortal(opts: {
  statusCadastro?: "PENDENTE_ANALISE_FINANCEIRA" | "APROVADO" | "REJEITADO" | null;
  condicaoPagamento?: string | null;
}): boolean {
  const status = opts.statusCadastro ?? null;
  if (status === "PENDENTE_ANALISE_FINANCEIRA" || status === "REJEITADO") return false;
  const v = (opts.condicaoPagamento ?? "").trim().toUpperCase();
  if (v === "AVISTA_PIX" || v === "PIX" || v === "FATURAMENTO_PIX" || v === "A_VISTA") return false;
  return true;
}

export function isLayoutPixPortal(opts: {
  statusCadastro?: "PENDENTE_ANALISE_FINANCEIRA" | "APROVADO" | "REJEITADO" | null;
  condicaoPagamento?: string | null;
}): boolean {
  return !isLayoutFaturamentoPortal(opts);
}

export function textoCondicaoVigente(opts: {
  statusCadastro?: "PENDENTE_ANALISE_FINANCEIRA" | "APROVADO" | "REJEITADO" | null;
  condicaoPagamento?: string | null;
  prazoPagamento?: string | null;
  condicaoPagamentoLabel?: string | null;
  prazoPagamentoLabel?: string | null;
}): { titulo: string; descricao: string } {
  const status = opts.statusCadastro ?? null;
  if (status === "PENDENTE_ANALISE_FINANCEIRA") {
    return {
      titulo: "À vista · PIX",
      descricao:
        "Seu cadastro está em análise pela área financeira (prazo de até 48 horas). Até a conclusão, as solicitações seguem com pagamento à vista via PIX, com quitação antes da coleta.",
    };
  }
  if (status === "REJEITADO") {
    return {
      titulo: "Cadastro não aprovado",
      descricao:
        "A análise financeira não aprovou o cadastro neste momento. Entre em contato com o financeiro da RL Transportes.",
    };
  }
  const formaL =
    opts.condicaoPagamentoLabel?.trim() || labelCondicaoPagamento(opts.condicaoPagamento);
  const prazoL = opts.prazoPagamentoLabel?.trim() || labelPrazoPagamento(opts.prazoPagamento);
  const titulo = prazoL !== "—" ? `${formaL} · ${prazoL}` : formaL;
  const descricao =
    descricaoCondicaoPagamento(opts.condicaoPagamento) ??
    (status === "APROVADO"
      ? "Condição comercial aprovada pela área financeira da RL Transportes."
      : "Condição de pagamento vigente para as suas solicitações.");
  return { titulo, descricao };
}
