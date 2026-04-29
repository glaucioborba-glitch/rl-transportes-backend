/**
 * Converte início/fim de relatório: strings só-data (YYYY-MM-DD) usam
 * 00:00:00.000 no primeiro dia e 23:59:59.999 no último (fuso do servidor), para
 * incluir o dia `dataFim` completo.
 */
export function parseRelatorioInicioFim(dataInicio: string, dataFim: string): {
  ini: Date;
  fim: Date;
} {
  const dOnly = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test((s || '').trim());

  if (dOnly(dataInicio) && dOnly(dataFim)) {
    const [yi, mi, di] = dataInicio.split('-').map((x) => parseInt(x, 10));
    const [yf, mf, df] = dataFim.split('-').map((x) => parseInt(x, 10));
    return {
      ini: new Date(yi, mi - 1, di, 0, 0, 0, 0),
      fim: new Date(yf, mf - 1, df, 23, 59, 59, 999),
    };
  }

  return { ini: new Date(dataInicio), fim: new Date(dataFim) };
}
