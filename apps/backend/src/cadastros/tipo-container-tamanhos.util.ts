export const TAMANHOS_CONTAINER_ORDEM = ['20', '40', '45'] as const;

export type TamanhoContainer = (typeof TAMANHOS_CONTAINER_ORDEM)[number];

/** Normaliza "20'", "20", " 40 " → "20" | "40" | "45". */
export function normalizeTamanhoContainer(value: unknown): string {
  if (value == null) return '';
  return String(value).replace(/['"\s]/g, '').trim();
}

/** Lista única, ordenada, só valores válidos. */
export function normalizeTamanhosContainer(values: unknown): string[] {
  const seen = new Set<string>();
  const raw = Array.isArray(values) ? values : [];
  for (const item of raw) {
    const n = normalizeTamanhoContainer(item);
    if (TAMANHOS_CONTAINER_ORDEM.includes(n as TamanhoContainer)) {
      seen.add(n);
    }
  }
  return TAMANHOS_CONTAINER_ORDEM.filter((t) => seen.has(t));
}

/** Formato exibido na matriz de preços e contratos (`20'`). */
export function formatTamanhoContainerMatrix(value: unknown): string {
  const n = normalizeTamanhoContainer(value);
  return n ? `${n}'` : '';
}
