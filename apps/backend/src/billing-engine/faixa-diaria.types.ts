export type FaixaDiaria = {
  diaInicio: number;
  diaFim: number | null;
  valorDiaria: number;
};

export function parseFaixasDiaria(raw: unknown): FaixaDiaria[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((f) => {
      if (!f || typeof f !== 'object') return null;
      const row = f as Record<string, unknown>;
      const diaInicio = Number(row.diaInicio);
      const valorDiaria = Number(row.valorDiaria);
      if (!Number.isFinite(diaInicio) || !Number.isFinite(valorDiaria)) return null;
      const diaFimRaw = row.diaFim;
      const diaFim =
        diaFimRaw == null || diaFimRaw === ''
          ? null
          : Number.isFinite(Number(diaFimRaw))
            ? Number(diaFimRaw)
            : null;
      return { diaInicio, diaFim, valorDiaria };
    })
    .filter((f): f is FaixaDiaria => f != null)
    .sort((a, b) => a.diaInicio - b.diaInicio);
}
