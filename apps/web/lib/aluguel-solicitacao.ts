export const FINALIDADE_ALUGUEL = {
  RETIRADA_USO_EXTERNO: "RETIRADA_USO_EXTERNO",
  UTILIZACAO_PATIO_FL: "UTILIZACAO_PATIO_FL",
} as const;

export type FinalidadeAluguel = (typeof FINALIDADE_ALUGUEL)[keyof typeof FINALIDADE_ALUGUEL];

export const FINALIDADE_ALUGUEL_OPCOES: Array<{ value: FinalidadeAluguel; label: string }> = [
  { value: "RETIRADA_USO_EXTERNO", label: "Retirada para uso externo" },
  { value: "UTILIZACAO_PATIO_FL", label: "Utilização dentro do pátio da FL" },
];

export const STATUS_SOLICITACAO_ALUGUEL_LABEL: Record<string, string> = {
  PENDENTE: "Aguardando autorização",
  APROVADO: "Autorizada",
  REJEITADO: "Rejeitada",
  INICIADO: "Em operação",
  ENCERRADO: "Encerrada",
};

export function rotuloFinalidadeAluguel(value: string | null | undefined): string {
  return FINALIDADE_ALUGUEL_OPCOES.find((o) => o.value === value)?.label ?? value ?? "—";
}

export function formatYmdBr(value?: string | null): string {
  if (!value) return "—";
  const ymd = String(value).slice(0, 10);
  const [y, m, d] = ymd.split("-");
  if (y && m && d && ymd.length === 10) return `${d}/${m}/${y}`;
  return ymd;
}

export function todayLocalIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
