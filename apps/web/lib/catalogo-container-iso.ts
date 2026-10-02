export type CatalogoContainerIso = {
  unidadeIso: string;
  tipoIso: string | null;
  tipoCodigo: string | null;
  tamanhoPes: string | null;
  perfil: string | null;
  capacidade?: "DC" | "HC" | null;
  rotulo: string | null;
  mgwKg: number | null;
  taraKg: number | null;
  payloadKg: number | null;
  owner: string | null;
};

export function catalogoContainerHint(hit: CatalogoContainerIso | null | undefined): string {
  if (!hit) return "";
  const partes = [
    hit.tipoIso,
    hit.capacidade,
    hit.rotulo,
    hit.taraKg != null ? `tara ${hit.taraKg} kg` : null,
    hit.mgwKg != null ? `MGW ${hit.mgwKg} kg` : null,
    hit.payloadKg != null ? `payload ${hit.payloadKg} kg` : null,
  ].filter(Boolean);
  return partes.length ? `Catálogo: ${partes.join(" · ")}` : "";
}

export function patchFromCatalogo<T extends { tipo?: string; tamanho?: string }>(
  atual: T,
  hit: CatalogoContainerIso,
  tiposCodigos?: string[],
): Partial<T> {
  const patch: Partial<T> = {};
  const tipoOk =
    hit.tipoCodigo &&
    (!tiposCodigos?.length || tiposCodigos.some((c) => c === hit.tipoCodigo));
  if (tipoOk && !String(atual.tipo ?? "").trim()) {
    patch.tipo = hit.tipoCodigo as T["tipo"];
  }
  if (hit.tamanhoPes && !String(atual.tamanho ?? "").trim()) {
    patch.tamanho = hit.tamanhoPes as T["tamanho"];
  }
  return patch;
}
