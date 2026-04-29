import { mean } from './linear-regression';

/** Suavização exponencial simples nível (alpha em ]0,1]). */
export function simpleExponentialSmoothing(series: number[], alpha: number): number[] {
  const a = Math.min(0.99, Math.max(0.01, alpha));
  if (series.length === 0) return [];
  const out: number[] = [];
  let lvl = series[0];
  out.push(lvl);
  for (let i = 1; i < series.length; i++) {
    lvl = a * series[i] + (1 - a) * lvl;
    out.push(lvl);
  }
  return out;
}

/** Previsão um passo à frente SES. */
export function sesForecastNext(series: number[], alpha: number): number {
  const sm = simpleExponentialSmoothing(series, alpha);
  return sm[sm.length - 1] ?? 0;
}
