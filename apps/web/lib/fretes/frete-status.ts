export const STATUS_FRETE = [
  "PENDENTE",
  "PROGRAMADO",
  "EM_ANDAMENTO",
  "CONCLUIDO",
  "PROBLEMA",
  "CANCELADO",
] as const;

export type StatusFrete = (typeof STATUS_FRETE)[number];

export const TIPO_FRETE = ["EXP", "IMP", "DEVOLUCAO_VAZIO", "RETIRADA_VAZIO"] as const;
export type TipoFrete = (typeof TIPO_FRETE)[number];

/** Cores da planilha EMBARQUES (preenchimento Excel). */
export const STATUS_FRETE_META: Record<
  StatusFrete,
  { label: string; bg: string; color: string }
> = {
  PENDENTE: { label: "Pendente", bg: "#FFFF00", color: "#111111" },
  PROGRAMADO: { label: "Programado", bg: "#FF9900", color: "#111111" },
  EM_ANDAMENTO: { label: "Em andamento", bg: "#00FFFF", color: "#111111" },
  CONCLUIDO: { label: "Concluído", bg: "#00FF00", color: "#111111" },
  PROBLEMA: { label: "Problema", bg: "#FF0000", color: "#FFFFFF" },
  CANCELADO: { label: "Cancelado", bg: "#999999", color: "#111111" },
};

export const TIPO_FRETE_LABEL: Record<TipoFrete, string> = {
  EXP: "EXP",
  IMP: "IMP",
  DEVOLUCAO_VAZIO: "Devolução vazio",
  RETIRADA_VAZIO: "Retirada vazio",
};

export function hojeIsoSaoPaulo(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export function inicioSemanaIso(hoje = hojeIsoSaoPaulo()): string {
  const [y, m, d] = hoje.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const weekday = date.getUTCDay();
  const diff = weekday === 0 ? 6 : weekday - 1;
  date.setUTCDate(date.getUTCDate() - diff);
  return date.toISOString().slice(0, 10);
}
