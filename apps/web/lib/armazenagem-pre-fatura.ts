export type PreFaturaPortalResponse = {
  containerIso: string;
  isoFormatado: string;
  status: "ABERTA" | "CONSOLIDADA";
  valorAcumulado: number;
  diasCobrados: number;
  diasEstadia: number;
  freeTimeDias: number;
  valorDiaria: number;
  cobrancaInicioEm: string | null;
  gateInEm: string;
  provisionado: boolean;
  aviso: string;
};

export { formatBRL as formatMoneyBrl } from "@/lib/financeiro/format";

export function formatDateBr(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(iso));
  } catch {
    return iso;
  }
}
