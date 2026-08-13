export const TAMANHOS_CONTAINER_OPCOES = ["20", "40", "45"] as const;

/**
 * Códigos legados → código atual do cadastro MDM (matriz operacional).
 */
export const TIPO_CONTAINER_LEGACY_ALIASES: Record<string, string> = {
  DRY: "DRYDC",
  DC: "DRYDC",
  HC: "DRYHC",
  OT: "OPENTOP",
  FR: "FLATRACK",
  TANK: "ISOTANK",
};

/**
 * Normaliza tamanho para o canônico do cadastro (`20` | `40` | `45`).
 * Aceita legado ISO-like (`20DC`, `40HC`, `20'`, `20 ft`).
 */
export function normalizeTamanhoContainer(value: unknown): string {
  if (value == null) return "";
  const raw = String(value).replace(/['"\s]/g, "").trim().toUpperCase();
  if (!raw) return "";
  const known = raw.match(/^(20|40|45)/);
  if (known) return known[1];
  return raw;
}

export function normalizeTamanhosContainer(values: unknown): string[] {
  const seen = new Set<string>();
  const raw = Array.isArray(values) ? values : [];
  for (const item of raw) {
    const n = normalizeTamanhoContainer(item);
    if (TAMANHOS_CONTAINER_OPCOES.includes(n as (typeof TAMANHOS_CONTAINER_OPCOES)[number])) {
      seen.add(n);
    }
  }
  return TAMANHOS_CONTAINER_OPCOES.filter((t) => seen.has(t));
}

export function formatTipoContainerCodigo(tipo: unknown): string {
  return String(tipo ?? "")
    .trim()
    .toUpperCase();
}

export function resolveTipoContainerCodigo(
  tipo: unknown,
  catalogCodigos?: Iterable<string>,
): string {
  const raw = formatTipoContainerCodigo(tipo);
  if (!raw) return "";

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

/** Formato exibido no cadastro e listas (`20'`). */
export function formatTamanhoContainerDisplay(value: unknown): string {
  const n = normalizeTamanhoContainer(value);
  return n ? `${n}'` : "";
}

/**
 * Label padrão intranet/portal alinhado ao cadastro: `DRYDC / 20'`.
 */
export function formatTipoTamanhoContainerLabel(
  tipo?: unknown,
  tamanho?: unknown,
  catalogCodigos?: Iterable<string>,
): string | null {
  const t = resolveTipoContainerCodigo(tipo, catalogCodigos);
  const tam = formatTamanhoContainerDisplay(tamanho);
  if (t && tam) return `${t} / ${tam}`;
  if (t) return t;
  if (tam) return tam;
  return null;
}

/** Re-normaliza label composto legado (`DRY / 20DC` → `DRYDC / 20'`). */
export function coerceTipoTamanhoContainerLabel(
  value: unknown,
  catalogCodigos?: Iterable<string>,
): string | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const sep = raw.includes(" / ")
    ? " / "
    : raw.includes("/")
      ? "/"
      : raw.includes(" · ")
        ? " · "
        : null;
  if (sep) {
    const [tipo, ...rest] = raw.split(sep);
    return formatTipoTamanhoContainerLabel(tipo, rest.join(sep).trim(), catalogCodigos);
  }
  return formatTipoTamanhoContainerLabel(raw, undefined, catalogCodigos);
}

export function tamanhoContainerSelecionado(tamanhos: string[], opcao: string): boolean {
  const alvo = normalizeTamanhoContainer(opcao);
  return tamanhos.some((t) => normalizeTamanhoContainer(t) === alvo);
}
