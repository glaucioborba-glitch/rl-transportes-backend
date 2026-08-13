export const TAMANHOS_CONTAINER_ORDEM = ['20', '40', '45'] as const;

export type TamanhoContainer = (typeof TAMANHOS_CONTAINER_ORDEM)[number];

/**
 * Códigos legados (seeds/demos) → código atual do cadastro MDM.
 * O cadastro operacional é a matriz; aliases só suavizam histórico.
 */
export const TIPO_CONTAINER_LEGACY_ALIASES: Record<string, string> = {
  DRY: 'DRYDC',
  DC: 'DRYDC',
  HC: 'DRYHC',
  OT: 'OPENTOP',
  FR: 'FLATRACK',
  TANK: 'ISOTANK',
};

/**
 * Normaliza tamanho para o canônico do cadastro (`20` | `40` | `45`).
 * Aceita legado ISO-like (`20DC`, `40HC`, `20'`, `20 ft`).
 */
export function normalizeTamanhoContainer(value: unknown): string {
  if (value == null) return '';
  const raw = String(value).replace(/['"\s]/g, '').trim().toUpperCase();
  if (!raw) return '';
  const known = raw.match(/^(20|40|45)/);
  if (known) return known[1];
  return raw;
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

/** Código bruto em maiúsculas. */
export function formatTipoContainerCodigo(tipo: unknown): string {
  return String(tipo ?? '')
    .trim()
    .toUpperCase();
}

/** Resolve o código MDM (aplica alias legado e confere catálogo quando informado). */
export function resolveTipoContainerCodigo(
  tipo: unknown,
  catalogCodigos?: Iterable<string>,
): string {
  const raw = formatTipoContainerCodigo(tipo);
  if (!raw) return '';

  const set = catalogCodigos
    ? new Set(Array.from(catalogCodigos, (c) => String(c).trim().toUpperCase()).filter(Boolean))
    : null;

  if (!set) {
    return TIPO_CONTAINER_LEGACY_ALIASES[raw] ?? raw;
  }
  if (set.has(raw)) return raw;

  const aliased = TIPO_CONTAINER_LEGACY_ALIASES[raw];
  if (aliased && set.has(aliased)) return aliased;

  return aliased ?? raw;
}

/** Formato exibido na matriz de preços e contratos (`20'`). */
export function formatTamanhoContainerMatrix(value: unknown): string {
  const n = normalizeTamanhoContainer(value);
  if (!n) return '';
  return `${n}'`;
}

/**
 * Label alinhado ao cadastro tipos-container: `DRYDC / 20'`.
 */
export function formatTipoTamanhoContainerLabel(
  tipo?: unknown,
  tamanho?: unknown,
  catalogCodigos?: Iterable<string>,
): string | null {
  const t = resolveTipoContainerCodigo(tipo, catalogCodigos);
  const tam = formatTamanhoContainerMatrix(tamanho);
  if (t && tam) return `${t} / ${tam}`;
  if (t) return t;
  if (tam) return tam;
  return null;
}
