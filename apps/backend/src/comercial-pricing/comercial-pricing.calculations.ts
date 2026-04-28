/** Funções puras de pricing / ABC / elasticidade — testáveis independentemente do Prisma. */

export type AbcInputRow = { id: string; lucro: number };

export type AbcOutputRow = AbcInputRow & {
  classe: 'A' | 'B' | 'C';
  contribuicaoLucroAcumPct: number;
};

/**
 * Curva ABC pela contribuição ao lucro (ordem decrescente). Classes por cumulativo do lucro positivo:
 * A até 80%, B até 95%, C restante (15%+5%).
 */
export function curvaAbcPorLucratividade(rows: AbcInputRow[]): AbcOutputRow[] {
  const sorted = [...rows].sort((a, b) => b.lucro - a.lucro);
  const totalLucroPos = sorted.reduce((s, r) => s + Math.max(0, r.lucro), 0);
  if (totalLucroPos <= 0) {
    return sorted.map((r) => ({
      ...r,
      classe: 'C' as const,
      contribuicaoLucroAcumPct: 0,
    }));
  }
  let cum = 0;
  return sorted.map((r) => {
    cum += Math.max(0, r.lucro);
    const pct = cum / totalLucroPos;
    const classe: 'A' | 'B' | 'C' = pct <= 0.8 ? 'A' : pct <= 0.95 ? 'B' : 'C';
    return {
      id: r.id,
      lucro: r.lucro,
      classe,
      contribuicaoLucroAcumPct: Math.round(pct * 10_000) / 100,
    };
  });
}

export type SerieMesVolPreco = { mes: string; volume: number; precoMedio: number };

/** Elasticidade média ponto a ponto: média de (%ΔQ/%ΔP) entre meses consecutivos válidos. */
export function elasticidadeDemandaPreco(series: SerieMesVolPreco[]): number | null {
  if (series.length < 2) return null;
  const ratios: number[] = [];
  for (let i = 1; i < series.length; i++) {
    const p0 = series[i - 1].precoMedio;
    const p1 = series[i].precoMedio;
    const q0 = series[i - 1].volume;
    const q1 = series[i].volume;
    if (p0 <= 0 || p1 <= 0 || q0 <= 0 || q1 <= 0) continue;
    const dP = (p1 - p0) / p0;
    const dQ = (q1 - q0) / q0;
    if (Math.abs(dP) < 1e-9) continue;
    ratios.push(dQ / dP);
  }
  if (ratios.length === 0) return null;
  return ratios.reduce((a, b) => a + b, 0) / ratios.length;
}

export type SimuladorInput = {
  precoAtual: number;
  precoNovo: number;
  custo: number;
  volumeAtual: number;
  /** Se omitido, usa default conservador (demanda inelástica curta). */
  elasticidade?: number | null;
};

export type SimuladorOutput = {
  margemAtual: number | null;
  margemNova: number | null;
  impactoReceitaLinear: number;
  impactoVolumeEstimado: number;
  receitaAtual: number;
  receitaNovaEstimada: number;
  volumeEstimado: number;
  elasticidadeAplicada: number;
};

const ELASTICIDADE_PADRAO = -0.35;

export function simuladorComercial(input: SimuladorInput): SimuladorOutput {
  const { precoAtual, precoNovo, custo, volumeAtual } = input;
  const e = input.elasticidade ?? ELASTICIDADE_PADRAO;
  const margemAtual = precoAtual > 0 ? (precoAtual - custo) / precoAtual : null;
  const margemNova = precoNovo > 0 ? (precoNovo - custo) / precoNovo : null;
  const impactoReceitaLinear = (precoNovo - precoAtual) * volumeAtual;
  const pctPreco = precoAtual > 0 ? (precoNovo - precoAtual) / precoAtual : 0;
  const volumeEstimado = Math.max(0, volumeAtual * (1 + e * pctPreco));
  const impactoVolumeEstimado = volumeEstimado - volumeAtual;
  const receitaAtual = precoAtual * volumeAtual;
  const receitaNovaEstimada = precoNovo * volumeEstimado;
  return {
    margemAtual: margemAtual !== null ? Math.round(margemAtual * 10_000) / 10_000 : null,
    margemNova: margemNova !== null ? Math.round(margemNova * 10_000) / 10_000 : null,
    impactoReceitaLinear: Math.round(impactoReceitaLinear * 100) / 100,
    impactoVolumeEstimado: Math.round(impactoVolumeEstimado * 100) / 100,
    receitaAtual: Math.round(receitaAtual * 100) / 100,
    receitaNovaEstimada: Math.round(receitaNovaEstimada * 100) / 100,
    volumeEstimado: Math.round(volumeEstimado * 100) / 100,
    elasticidadeAplicada: e,
  };
}
