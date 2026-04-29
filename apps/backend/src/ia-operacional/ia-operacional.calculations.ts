/** Motor determinístico de previsões IA operacional (sem ML pesado — regressão leve + estatística descritiva). */

export type HorizonteHoras = 2 | 4 | 8;

export interface SerieEtapaMinutos {
  portaria: number[];
  gate: number[];
  patio: number[];
  saida: number[];
}

export interface MetricasConfiancaDto {
  /** 0–1 — maior com mais observações estáveis */
  score: number;
  nivel: 'alta' | 'media' | 'baixa';
  observacoesConsideradas: number;
}

export interface SazonalidadeDto {
  amplitudePct: number;
  descricao: string;
}

export interface PrevisaoGargaloHorizonteDto {
  horas: HorizonteHoras;
  probabilidadePortaria: number;
  probabilidadeGate: number;
  probabilidadePatio: number;
  probabilidadeSaida: number;
}

export interface PatioHotspotDto {
  quadra: string;
  ocupacaoRelativa: number;
  saturacaoPct: number;
}

export interface PatioRecomendacaoMovimentoDto {
  quadraOrigem: string;
  quadraDestino: string;
  prioridade: number;
  motivo: string;
}

function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0;
  return Math.min(1, Math.max(0, x));
}

function mean(xs: number[]): number {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stdPop(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const v = xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length;
  return Math.sqrt(v);
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p));
  return sorted[idx];
}

/** Razão dos últimos K valores vs mediana histórica (>1 indica pressão). */
export function pressaoPorEtapa(samples: number[], recentK = 24): number {
  if (samples.length < 3) return 0.5;
  const sorted = [...samples].sort((a, b) => a - b);
  const med = percentile(sorted, 0.5);
  const recent = samples.slice(-Math.min(recentK, samples.length));
  const mr = mean(recent);
  if (med <= 0) return clamp01(mr / Math.max(mean(samples), 1));
  return clamp01((mr / med - 0.85) / 1.5 + 0.35);
}

/** Probabilidade de gargalo por etapa e horizonte (janelas maiores amplificam levemente). */
export function probabilidadeGargaloEtapa(
  samples: number[],
  horizonHours: HorizonteHoras,
): number {
  const base = pressaoPorEtapa(samples);
  const horizonBoost = horizonHours === 2 ? 1 : horizonHours === 4 ? 1.06 : 1.12;
  return clamp01(base * horizonBoost * 0.92 + 0.08 * Math.sin((base + horizonHours) * 1.7));
}

export function metricasConfianca(observacoes: number): MetricasConfiancaDto {
  const score = clamp01(Math.min(1, observacoes / 120));
  const nivel = score >= 0.55 ? 'alta' : score >= 0.22 ? 'media' : 'baixa';
  return { score, nivel, observacoesConsideradas: observacoes };
}

export function tendenciaTemporal(values: number[]): 'subindo' | 'estavel' | 'descendo' {
  if (values.length < 4) return 'estavel';
  const mid = Math.floor(values.length / 2);
  const a = mean(values.slice(0, mid));
  const b = mean(values.slice(mid));
  const delta = (b - a) / Math.max(a, 1e-6);
  if (delta > 0.08) return 'subindo';
  if (delta < -0.08) return 'descendo';
  return 'estavel';
}

/** Amplitude sazonal simplificada (razão máx/mín por buckets semanais ou dispersão). */
export function sazonaliadePorDispersao(samples: number[]): SazonalidadeDto {
  if (samples.length < 8) {
    return {
      amplitudePct: 0,
      descricao: 'Amostra insuficiente para sazonalidade robusta.',
    };
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const lo = percentile(sorted, 0.1);
  const hi = percentile(sorted, 0.9);
  const ampPct = hi > 0 ? Math.round(((hi - lo) / hi) * 1000) / 10 : 0;
  const descricao =
    ampPct > 35
      ? 'Alta variância temporal nos tempos de etapa — revisar cadência de turnos.'
      : ampPct > 18
        ? 'Variância moderada; monitorar picos por dia da semana.'
        : 'Padrão relativamente estável no histórico.';
  return { amplitudePct: ampPct, descricao };
}

export function previsoesGargaloPorHorizontes(
  series: SerieEtapaMinutos,
): PrevisaoGargaloHorizonteDto[] {
  const horizontes: HorizonteHoras[] = [2, 4, 8];
  return horizontes.map((horas) => ({
    horas,
    probabilidadePortaria: probabilidadeGargaloEtapa(series.portaria, horas),
    probabilidadeGate: probabilidadeGargaloEtapa(series.gate, horas),
    probabilidadePatio: probabilidadeGargaloEtapa(series.patio, horas),
    probabilidadeSaida: probabilidadeGargaloEtapa(series.saida, horas),
  }));
}

/** Previsão de ciclo total (minutos): média móvel + banda pelo desvio histórico. */
export function previsaoCicloMinutos(amostrasMinutos: number[]): {
  previstoMinutos: number;
  desvioPadraoMinutos: number;
  bandaInferiorMinutos: number;
  bandaSuperiorMinutos: number;
} {
  if (!amostrasMinutos.length) {
    return {
      previstoMinutos: 180,
      desvioPadraoMinutos: 45,
      bandaInferiorMinutos: 120,
      bandaSuperiorMinutos: 240,
    };
  }
  const maWindow = Math.min(48, amostrasMinutos.length);
  const ma = mean(amostrasMinutos.slice(-maWindow));
  const sigma = stdPop(amostrasMinutos);
  const prev = Math.round(ma * 10) / 10;
  const bi = Math.max(15, Math.round(prev - 1.65 * sigma));
  const bs = Math.round(prev + 1.65 * sigma);
  return {
    previstoMinutos: prev,
    desvioPadraoMinutos: Math.round(sigma * 10) / 10,
    bandaInferiorMinutos: bi,
    bandaSuperiorMinutos: bs,
  };
}

/** Balanceamento sugerido: quadras acima da mediana → destinos abaixo. */
export function recomendarBalanceamentoPatio(
  ocupacaoPorQuadra: Record<string, number>,
  capacidadePorQuadra?: Record<string, number>,
): PatioRecomendacaoMovimentoDto[] {
  const quadras = Object.keys(ocupacaoPorQuadra);
  if (!quadras.length) return [];

  const valores = quadras.map((q) => ocupacaoPorQuadra[q]);
  const med = percentile([...valores].sort((a, b) => a - b), 0.5);
  const hot = quadras.filter((q) => ocupacaoPorQuadra[q] >= med * 1.15);
  const cold = quadras.filter((q) => ocupacaoPorQuadra[q] <= med * 0.85);

  const out: PatioRecomendacaoMovimentoDto[] = [];
  let prio = 1;
  for (const o of hot) {
    for (const d of cold) {
      if (o === d) continue;
      const cap =
        capacidadePorQuadra?.[d] ??
        capacidadePorQuadra?.[o] ??
        Math.max(...valores, 1);
      const livreEstimado = Math.max(0, cap - ocupacaoPorQuadra[d]);
      out.push({
        quadraOrigem: o,
        quadraDestino: d,
        prioridade: prio++,
        motivo: `Origem saturada (${ocupacaoPorQuadra[o]} u.) vs destino com folga (~${livreEstimado.toFixed(0)} u.).`,
      });
    }
  }
  return out.slice(0, 12);
}

export function hotspotsPatio(
  ocupacaoPorQuadra: Record<string, number>,
  capacidadeEstimadaPorQuadra?: Record<string, number>,
): PatioHotspotDto[] {
  const entries = Object.entries(ocupacaoPorQuadra);
  if (!entries.length) return [];
  const occVals = entries.map(([, v]) => v);
  const maxOcc = Math.max(...occVals, 1);
  return entries
    .map(([quadra, occ]) => {
      const cap = capacidadeEstimadaPorQuadra?.[quadra] ?? maxOcc * 1.35;
      const sat = clamp01(occ / Math.max(cap, 1));
      return {
        quadra,
        ocupacaoRelativa: Math.round((occ / maxOcc) * 1000) / 1000,
        saturacaoPct: Math.round(sat * 1000) / 10,
      };
    })
    .sort((a, b) => b.saturacaoPct - a.saturacaoPct)
    .slice(0, 20);
}
