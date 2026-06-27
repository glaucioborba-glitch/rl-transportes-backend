import type { TipoOperacaoSolicitacaoIntent } from "@/lib/api/portal-client";

export const SOLICITACAO_INTENT_OPTIONS: Array<{
  value: TipoOperacaoSolicitacaoIntent;
  label: string;
}> = [
  { value: "SOLICITAR_BAIXA", label: "Solicitar Baixa" },
  { value: "SOLICITAR_IMPORTACAO_COLETA_DEPOT", label: "Solicitar Importação/coleta depot" },
  { value: "SOLICITAR_COLETA", label: "Solicitar Coleta" },
  { value: "SOLICITAR_EXPORTACAO_ENTREGA_DEPOT", label: "Solicitar Exportação/Entrega Depot" },
];

export function intentUsesFlFrete(intent: TipoOperacaoSolicitacaoIntent | null): boolean {
  return (
    intent === "SOLICITAR_IMPORTACAO_COLETA_DEPOT" ||
    intent === "SOLICITAR_EXPORTACAO_ENTREGA_DEPOT"
  );
}

/** Import/coleta depot e coleta avulsa — permanência estimada no pátio. */
export function intentUsesPrevisaoRetirada(intent: TipoOperacaoSolicitacaoIntent | null): boolean {
  return (
    intent === "SOLICITAR_COLETA" ||
    intent === "SOLICITAR_IMPORTACAO_COLETA_DEPOT"
  );
}

/** Export/entrega depot — deadline navio/booking. */
export function intentUsesBookingDeadline(intent: TipoOperacaoSolicitacaoIntent | null): boolean {
  return intent === "SOLICITAR_EXPORTACAO_ENTREGA_DEPOT";
}

export function optionalDateTimeLocalToIso(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

export function intentLabel(intent: TipoOperacaoSolicitacaoIntent | null): string {
  return SOLICITACAO_INTENT_OPTIONS.find((o) => o.value === intent)?.label ?? "Nova solicitação";
}
