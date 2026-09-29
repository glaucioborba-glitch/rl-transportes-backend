import type { PortalPatioSaldoItem } from "@/lib/api/portal-client";
import { formatTipoTamanhoContainerLabel } from "@/lib/cadastros/tipo-container-tamanhos";

export function patioCargaLabel(status: PortalPatioSaldoItem["statusContainer"]): string {
  if (status === "CHEIO") return "Cheio";
  if (status === "VAZIO") return "Vazio";
  return "—";
}

export function patioEquipamentoLabel(item: PortalPatioSaldoItem): string {
  return formatTipoTamanhoContainerLabel(item.tipo, item.tamanho) ?? item.tipo ?? "—";
}

export function patioDataAgendamentoLabel(value?: string | null): string {
  const ymd = value?.trim().slice(0, 10) ?? "";
  const [y, m, d] = ymd.split("-");
  return y && m && d ? `${d}/${m}/${y}` : "";
}

export function patioHoraJanelaLabel(inicio?: string | null, fim?: string | null): string {
  const a = inicio?.trim() ?? "";
  const b = fim?.trim() ?? "";
  if (a && b) return `${a} – ${b}`;
  return a || b || "";
}

export function patioHoraJanelaValor(inicio?: string | null, fim?: string | null): string {
  const a = inicio?.trim() ?? "";
  const b = fim?.trim() ?? "";
  if (a && b) return `${a}-${b}`;
  return "";
}

export function patioSaldoMatchesQuery(item: PortalPatioSaldoItem, q: string): boolean {
  const needle = q.trim().toLowerCase().replace(/[\s-]/g, "");
  if (!needle) return true;
  const hay = [
    item.unidadeIso,
    item.booking,
    item.processo,
    item.navio,
    item.localDestino,
    item.dataAgendamento,
    item.horaInicio,
    item.horaFim,
    item.protocolo,
    item.unidadeProcessoLabel,
    item.tipo,
    item.tamanho,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[\s-]/g, "");
  return hay.includes(needle);
}

export const CONSULTA_ESTOQUE_HREF = "/portal/patio";
export const ORGANIZADOR_EMBARQUE_HREF = "/portal/patio/organizador-embarque";
