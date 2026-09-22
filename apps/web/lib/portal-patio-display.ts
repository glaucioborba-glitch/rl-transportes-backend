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

export function patioSaldoMatchesQuery(item: PortalPatioSaldoItem, q: string): boolean {
  const needle = q.trim().toLowerCase().replace(/[\s-]/g, "");
  if (!needle) return true;
  const hay = [
    item.unidadeIso,
    item.booking,
    item.processo,
    item.navio,
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
