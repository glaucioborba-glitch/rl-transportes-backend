import type { SolicitacaoRow } from "@/lib/api/portal-client";
import { collectSolicitacaoContainerISOs, formatIsoDisplay } from "@/lib/container-display";
import { intentLabel } from "@/lib/solicitacao-intent";

export function deriveTrackingLabel(s: SolicitacaoRow): "Entrada" | "Pátio" | "Saída" {
  if (s.saida) return "Saída";
  if (s.patio) return "Pátio";
  return "Entrada";
}

export function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function solicitacaoContainersLabel(s: SolicitacaoRow): string {
  const all = collectSolicitacaoContainerISOs(s).map(formatIsoDisplay).filter((v) => v && v !== "—");
  return all.length ? all.join(" · ") : "—";
}

export function solicitacaoTipoLabel(s: SolicitacaoRow): string {
  if (s.tipoOperacao) return intentLabel(s.tipoOperacao);
  return operationTypeLabel(s);
}

export function operationTypeLabel(s: SolicitacaoRow): string {
  const tc = s.transporteSolicitacao?.tipoCaminhao;
  if (tc === "RODOTREM") return "Rodotrem";
  if (tc === "LS") return "LS";
  const u = s.unidades?.[0];
  if (!u?.tipo) return "—";
  const map: Record<string, string> = {
    IMPORT: "Importação",
    EXPORT: "Exportação",
    GATE_IN: "Gate In",
    GATE_OUT: "Gate Out",
  };
  return map[u.tipo] ?? u.tipo;
}
