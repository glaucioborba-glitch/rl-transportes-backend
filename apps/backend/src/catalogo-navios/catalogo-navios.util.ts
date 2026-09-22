export function stripNavioAccents(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '');
}

/** Chave única: maiúsculas, sem acento, espaços colapsados. */
export function normalizeNavioNome(raw: unknown): string {
  return stripNavioAccents(String(raw ?? ''))
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/** Nome exibido no catálogo (maiúsculas, espaços colapsados). */
export function formatNavioNome(raw: unknown): string {
  return String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

export function parseNavioNome(raw: unknown): { nome: string; nomeNorm: string } | null {
  const nome = formatNavioNome(raw).slice(0, 120);
  const nomeNorm = normalizeNavioNome(nome);
  if (nomeNorm.length < 2) return null;
  return { nome, nomeNorm };
}
