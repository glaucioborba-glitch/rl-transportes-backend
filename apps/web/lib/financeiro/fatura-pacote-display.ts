import type { FaturamentoModo, StatusFaturaPacote } from "@/lib/api/fatura-pacote-client";
import { formatIsoDisplay } from "@/lib/container-display";

const EVENTO_LABEL: Record<string, string> = {
  GATE_IN: "Gate-In",
  GATE_OUT: "Gate-Out",
  HANDLING: "Handling",
  DIARIA_ARMAZENAGEM: "Diária",
  SHIFTING_EXTRA: "Shifting",
  ENERGIA_REEFER: "Energia reefer",
  SERVICO_ADICIONAL: "Serviço",
  FRETE: "Frete",
};

export function labelEventoFatura(evento: string): string {
  return EVENTO_LABEL[evento] ?? evento;
}

export function labelModalidadeFatura(modalidade: string): string {
  if (modalidade === "ALUGUEL") return "Aluguel";
  if (modalidade === "PATIO") return "Pátio";
  return modalidade;
}

export function labelModoFatura(modo: FaturamentoModo, hora?: string | null): string {
  if (modo === "AUTOMATICO") return hora ? `Automático às ${hora}` : "Automático";
  return "Manual";
}

export function labelStatusFatura(status: StatusFaturaPacote): string {
  if (status === "ENVIADA") return "Enviada";
  if (status === "EMITINDO") return "Emitindo";
  if (status === "CANCELADA") return "Cancelada";
  if (status === "RASCUNHO") return "Agendada";
  return "Rascunho";
}

export function localDatetimeSp(offsetMs = 60 * 60 * 1000): string {
  const d = new Date(Date.now() + offsetMs);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function localDatetimeToIsoSp(local: string): string {
  return new Date(`${local}:00-03:00`).toISOString();
}

export function formatDataHoraBr(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function formatDataBr(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function linhaTituloIdFatura(row: {
  idLabel: string;
  unidadeIso: string;
  processo?: string | null;
  booking?: string | null;
}): string {
  const partes = [row.idLabel];
  const iso = formatIsoDisplay(row.unidadeIso);
  if (iso && iso !== "—") partes.push(iso);
  if (row.processo?.trim()) partes.push(`Processo ${row.processo.trim()}`);
  if (row.booking?.trim()) partes.push(`Booking ${row.booking.trim()}`);
  return partes.join(" · ");
}

export function linhaMetaIdFatura(row: {
  modalidade: string;
  entradaEm?: string | null;
  encerradoEm?: string | null;
}): string {
  const partes = [labelModalidadeFatura(row.modalidade)];
  if (row.entradaEm) partes.push(`entrada ${formatDataBr(row.entradaEm)}`);
  if (row.encerradoEm) partes.push(`encerrado ${formatDataBr(row.encerradoEm)}`);
  return partes.join(" · ");
}
