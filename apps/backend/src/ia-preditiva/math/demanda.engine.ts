import { fitLinear, mean } from './linear-regression';
import { sesForecastNext } from './exponential-smoothing';
import { factorForCalendarMonth, seasonalMonthlyFactors } from './seasonal-adjust';

export interface PontoMensal {
  /** Primeiro dia do mês (UTC). */
  periodo: Date;
  volume: number;
}

export type TendenciaLabel = 'alta' | 'estavel' | 'baixa';

export interface PrevisaoHorizonte {
  dias: number;
  volumePrevisto: number;
  /** 40–95 proxy */
  confiancaPct: number;
  tendencia: TendenciaLabel;
  explanationProxy: string[];
}

export interface DemandaEngineOutput {
  porHorizonte: Record<string, PrevisaoHorizonte>;
  serieMensalPontos: number;
  modelo: {
    regressaoR2: number;
    coefLinearB: number;
    sesAlpha: number;
    blendTrend: number;
    feriadosProxy: string;
  };
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + Math.round(days));
  return x;
}

/** Multiplicador simples fins de semana vs dias úteis (proxy feriados/dias úteis). */
export function fatorDiaUtil(date: Date): number {
  const day = date.getUTCDay();
  if (day === 0 || day === 6) return 0.88;
  return 1.03;
}

/**
 * Previsão de demanda mensal agregada extrapolada para horizontes em dias.
 * Combina regressão linear na série temporal, índices sazonais mensais e SES.
 */
export function preverDemandaVolume(input: {
  mensal: PontoMensal[];
  horizontesDias: number[];
  sesAlpha: number;
  blendTrend: number;
}): DemandaEngineOutput {
  const sorted = [...input.mensal].sort((a, b) => a.periodo.getTime() - b.periodo.getTime());
  const hs = [...new Set(input.horizontesDias)].sort((a, b) => a - b);

  if (sorted.length === 0) {
    const empty: Record<string, PrevisaoHorizonte> = {};
    for (const d of hs) {
      empty[String(d)] = {
        dias: d,
        volumePrevisto: 0,
        confiancaPct: 40,
        tendencia: 'estavel',
        explanationProxy: ['Sem dados históricos suficientes; série sintética não aplicada neste resultado.'],
      };
    }
    return {
      porHorizonte: empty,
      serieMensalPontos: 0,
      modelo: {
        regressaoR2: 0,
        coefLinearB: 0,
        sesAlpha: input.sesAlpha,
        blendTrend: input.blendTrend,
        feriadosProxy: 'fatorDiaUtil aplicado por data-alvo',
      },
    };
  }

  const ys = sorted.map((p) => p.volume);
  const xs = sorted.map((_, i) => i);
  const { a, b, r2 } = fitLinear(xs, ys);
  const sesLevel = sesForecastNext(ys, input.sesAlpha);

  const monthPoints = sorted.map((p) => ({
    month: p.periodo.getUTCMonth() + 1,
    value: p.volume,
  }));
  const factors = seasonalMonthlyFactors(monthPoints);

  const confBase = Math.round(Math.min(95, 40 + 55 * r2));
  const ultimo = sorted[sorted.length - 1];

  const porHorizonte: Record<string, PrevisaoHorizonte> = {};

  for (const dias of hs) {
    const targetDate = addDays(ultimo.periodo, dias);
    const tFuture = xs[xs.length - 1] + dias / 30;
    const linPred = Math.max(0, a + b * tFuture);
    const mCal = targetDate.getUTCMonth() + 1;
    const s = factorForCalendarMonth(factors, mCal);
    const blend = Math.min(0.95, Math.max(0.3, input.blendTrend));
    const comb =
      blend * linPred * s + (1 - blend) * sesLevel * s;
    const diaUtil = fatorDiaUtil(targetDate);
    const vol = Math.max(0, Math.round(comb * diaUtil));

    let tendencia: TendenciaLabel = 'estavel';
    if (b > 0.08) tendencia = 'alta';
    else if (b < -0.08) tendencia = 'baixa';

    const explain = [
      `coef_tendencia_linear=${b.toFixed(4)}`,
      `fator_sazonal_m${mCal}=${s.toFixed(3)}`,
      `ses_alpha=${input.sesAlpha}`,
      `blend_trend=${blend}`,
      `dia_util_proxy=${diaUtil}`,
    ];

    porHorizonte[String(dias)] = {
      dias,
      volumePrevisto: vol,
      confiancaPct: confBase,
      tendencia,
      explanationProxy: explain,
    };
  }

  return {
    porHorizonte,
    serieMensalPontos: sorted.length,
    modelo: {
      regressaoR2: r2,
      coefLinearB: b,
      sesAlpha: input.sesAlpha,
      blendTrend: input.blendTrend,
      feriadosProxy: 'fatorDiaUtil(date) para fins de semana ~0.88; dias úteis ~1.03',
    },
  };
}

/** Utilitário de teste: média da série. */
export function mediaSerie(pontos: PontoMensal[]): number {
  return mean(pontos.map((p) => p.volume));
}
