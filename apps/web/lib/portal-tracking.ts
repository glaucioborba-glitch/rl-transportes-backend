import type { SolicitacaoRow } from "@/lib/api/portal-client";
import { collectSolicitacaoContainerISOs, formatIsoDisplay } from "@/lib/container-display";
import { formatTipoTamanhoContainerLabel } from "@/lib/cadastros/tipo-container-tamanhos";
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

export function solicitacaoProtocoloDisplay(protocolo?: string | null): string {
  const v = protocolo?.trim();
  if (!v) return "—";
  return v.startsWith("#") ? v : `#${v}`;
}

export function solicitacaoIdOperacional(s: {
  unidadeProcessoNumero?: number | null;
  unidadeProcessoLabel?: string | null;
  unidadeProcessosEntrada?: Array<{ numero: number }> | null;
  unidadeProcessosSaida?: Array<{ numero: number }> | null;
}): { numero: number; label: string } | null {
  const n =
    s.unidadeProcessoNumero ??
    s.unidadeProcessosEntrada?.[0]?.numero ??
    s.unidadeProcessosSaida?.[0]?.numero ??
    null;
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  const label = s.unidadeProcessoLabel?.trim();
  return { numero: n, label: label || `ID ${n}` };
}

/** Depois que o ID nasce, ele é o controle principal; o protocolo fica como referência. */
export function solicitacaoControleDisplay(s: {
  protocolo?: string | null;
  unidadeProcessoNumero?: number | null;
  unidadeProcessoLabel?: string | null;
  unidadeProcessosEntrada?: Array<{ numero: number }> | null;
  unidadeProcessosSaida?: Array<{ numero: number }> | null;
}): { primario: string; secundario?: string } {
  const id = solicitacaoIdOperacional(s);
  const protoRaw = s.protocolo?.trim();
  if (id) {
    return {
      primario: id.label,
      ...(protoRaw ? { secundario: `Protocolo ${protoRaw}` } : {}),
    };
  }
  return { primario: solicitacaoProtocoloDisplay(protoRaw) };
}

export function solicitacaoSolicitanteLabel(s: SolicitacaoRow): string {
  return s.solicitanteContato?.nome?.trim() || "—";
}

export function solicitacaoBookingLabel(s: SolicitacaoRow): string {
  const booking = (s.containersSolicitacao ?? [])
    .map((c) => c.booking?.trim())
    .find((v) => v);
  return booking || "—";
}

export function solicitacaoEquipamentoLabel(s: SolicitacaoRow): string {
  const c = s.containersSolicitacao?.[0];
  if (!c) return "—";
  return formatTipoTamanhoContainerLabel(c.tipo, c.tamanho) ?? "—";
}

export function solicitacaoTransporteLabel(s: SolicitacaoRow): string {
  const placa = s.transporteSolicitacao?.placaCavalo?.trim();
  if (placa) return placa.toUpperCase();
  return "Pendente";
}
