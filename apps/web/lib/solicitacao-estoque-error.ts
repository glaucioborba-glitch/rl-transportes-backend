/** Extrai o ISO de erros de estoque do UnidadeProcessoService. */
export function parseUnidadeEstoqueError(message: string): { iso: string } | null {
  const m = message.match(
    /A unidade\s+([A-Z0-9]+)\s+(não está em estoque|já está em estoque)/i,
  );
  if (!m?.[1]) return null;
  return { iso: m[1].toUpperCase() };
}

export function fieldErrorForContainer(
  unidadeRaw: string,
  parsed: { iso: string } | null,
  message: string,
): string | null {
  if (!parsed) return null;
  const iso = unidadeRaw.replace(/[\s-]/g, "").toUpperCase();
  return iso === parsed.iso ? message : null;
}
