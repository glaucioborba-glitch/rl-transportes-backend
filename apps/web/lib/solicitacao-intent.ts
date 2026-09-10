import type { TipoOperacaoSolicitacaoIntent } from "@/lib/api/portal-client";
import { stripContainerISO } from "@/utils/containerFormatter";

export const SOLICITACAO_INTENT_OPTIONS: Array<{
  value: TipoOperacaoSolicitacaoIntent;
  label: string;
}> = [
  { value: "SOLICITAR_BAIXA", label: "Solicitar Baixa" },
  { value: "SOLICITAR_IMPORTACAO_COLETA_DEPOT", label: "Solicitar Importação/coleta depot" },
  { value: "SOLICITAR_COLETA", label: "Solicitar Coleta" },
  { value: "SOLICITAR_EXPORTACAO_ENTREGA_DEPOT", label: "Solicitar Exportação/Entrega Depot" },
];

export function intentUsesEstoqueDoCliente(intent: TipoOperacaoSolicitacaoIntent | null): boolean {
  return intent === "SOLICITAR_COLETA" || intent === "SOLICITAR_EXPORTACAO_ENTREGA_DEPOT";
}

export const SOLICITACAO_SAIDA_OPTIONS: Array<{
  value: TipoOperacaoSolicitacaoIntent;
  label: string;
}> = [
  { value: "SOLICITAR_COLETA", label: "Solicitar Coleta" },
  { value: "SOLICITAR_EXPORTACAO_ENTREGA_DEPOT", label: "Solicitar Exportação/Entrega Depot" },
];

export function isSolicitacaoSaidaIntent(
  value: string | null,
): value is "SOLICITAR_COLETA" | "SOLICITAR_EXPORTACAO_ENTREGA_DEPOT" {
  return value === "SOLICITAR_COLETA" || value === "SOLICITAR_EXPORTACAO_ENTREGA_DEPOT";
}

export function portalSolicitacaoSaidaHref(
  intent: TipoOperacaoSolicitacaoIntent,
  unidadeIso: string,
): string {
  const iso = stripContainerISO(unidadeIso);
  const q = new URLSearchParams({ saida: intent, iso });
  return `/portal/solicitacoes?${q.toString()}`;
}

export function intentUsesFlFrete(intent: TipoOperacaoSolicitacaoIntent | null): boolean {
  return (
    intent === "SOLICITAR_IMPORTACAO_COLETA_DEPOT" ||
    intent === "SOLICITAR_EXPORTACAO_ENTREGA_DEPOT"
  );
}

/** Só na entrada (importação/coleta depot) — na saída a unidade já está no pátio. */
export function intentUsesPrevisaoRetirada(intent: TipoOperacaoSolicitacaoIntent | null): boolean {
  return intent === "SOLICITAR_IMPORTACAO_COLETA_DEPOT";
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
