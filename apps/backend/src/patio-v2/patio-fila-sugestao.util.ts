export const PATIO_SUGESTAO_ORDEM = ['cliente', 'navio', 'booking', 'processo'] as const;
export type PatioSugestaoMotivo = (typeof PATIO_SUGESTAO_ORDEM)[number];

export type PatioSugestaoChaves = {
  clienteId?: string | null;
  navio?: string | null;
  booking?: string | null;
  processo?: string | null;
  processoNumero?: number | null;
};

export type PatioSugestaoVizinho = PatioSugestaoChaves & {
  zona: string;
  unidadeIso: string;
};

export type PatioSugestao = {
  zona: string;
  motivo: PatioSugestaoMotivo;
};

export function normalizePatioSugestaoValor(raw: string | null | undefined): string {
  return (raw ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
}

export function temChavePatioSugestao(chaves: PatioSugestaoChaves): boolean {
  return Boolean(
    normalizePatioSugestaoValor(chaves.clienteId) ||
      normalizePatioSugestaoValor(chaves.navio) ||
      normalizePatioSugestaoValor(chaves.booking) ||
      normalizePatioSugestaoValor(chaves.processo) ||
      chaves.processoNumero != null,
  );
}

function bateMotivo(
  incoming: PatioSugestaoChaves,
  vizinho: PatioSugestaoVizinho,
  motivo: PatioSugestaoMotivo,
): boolean {
  if (motivo === 'cliente') {
    const a = normalizePatioSugestaoValor(incoming.clienteId);
    const b = normalizePatioSugestaoValor(vizinho.clienteId);
    return Boolean(a && a === b);
  }
  if (motivo === 'navio') {
    const a = normalizePatioSugestaoValor(incoming.navio);
    const b = normalizePatioSugestaoValor(vizinho.navio);
    return Boolean(a && a === b);
  }
  if (motivo === 'booking') {
    const a = normalizePatioSugestaoValor(incoming.booking);
    const b = normalizePatioSugestaoValor(vizinho.booking);
    return Boolean(a && a === b);
  }
  const procIn = normalizePatioSugestaoValor(incoming.processo);
  const procViz = normalizePatioSugestaoValor(vizinho.processo);
  if (procIn && procIn === procViz) return true;
  return (
    incoming.processoNumero != null &&
    vizinho.processoNumero != null &&
    incoming.processoNumero === vizinho.processoNumero
  );
}

/** Cliente → navio → booking → processo. Só zona com pelo menos um slot livre. */
export function sugerirZonaPatio(
  incoming: PatioSugestaoChaves,
  vizinhos: PatioSugestaoVizinho[],
  livresPorZona: ReadonlyMap<string, number>,
  excludeIso?: string,
): PatioSugestao | null {
  if (!temChavePatioSugestao(incoming)) return null;
  const exclude = normalizePatioSugestaoValor(excludeIso);
  const pool = vizinhos.filter((v) => normalizePatioSugestaoValor(v.unidadeIso) !== exclude);

  for (const motivo of PATIO_SUGESTAO_ORDEM) {
    const hits = pool.filter((v) => bateMotivo(incoming, v, motivo));
    if (!hits.length) continue;
    const porZona = new Map<string, number>();
    for (const h of hits) {
      porZona.set(h.zona, (porZona.get(h.zona) ?? 0) + 1);
    }
    const candidatas = [...porZona.entries()]
      .filter(([zona]) => (livresPorZona.get(zona) ?? 0) > 0)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    if (candidatas[0]) return { zona: candidatas[0][0], motivo };
  }
  return null;
}

export function rotuloSugestaoPatio(sugestao: PatioSugestao | null): string {
  return sugestao?.zona ?? 'Sem Sugestão';
}
