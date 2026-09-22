import type { PortalPatioSaldoItem } from "@/lib/api/portal-client";
import { normalizeTamanhoContainer } from "@/lib/cadastros/tipo-container-tamanhos";
import { formatContainerISO } from "@/utils/containerFormatter";

/** Campos do contêiner a partir da unidade depositada (coleta / exportação).
 *  `item.lacre` é o atual (troca no pátio, se houver). */
export function patchContainerFromEstoquePatio(item: PortalPatioSaldoItem) {
  const status = item.statusContainer === "VAZIO" ? ("VAZIO" as const) : ("CHEIO" as const);
  const setPoint =
    item.refrigerado && item.setPoint != null && `${item.setPoint}`.trim() !== ""
      ? String(item.setPoint)
      : "";
  return {
    unidade: formatContainerISO(item.unidadeIso),
    tipo: item.tipo?.trim().toUpperCase() ?? "",
    tamanho: item.tamanho ? normalizeTamanhoContainer(item.tamanho) : "",
    status,
    booking: item.booking ?? "",
    processo: item.processo ?? "",
    navio: item.navio ?? "",
    refrigerado: Boolean(item.refrigerado),
    lacre: status === "VAZIO" ? "" : (item.lacre?.trim() ?? ""),
    setPoint,
  };
}
