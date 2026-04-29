import { mean } from './linear-regression';

/** Índices sazonais multiplicativos por mês civil (1–12). Fallback 1. */
export function seasonalMonthlyFactors(monthlySeries: { month: number; value: number }[]): number[] {
  const factors = Array.from({ length: 13 }, () => 0);
  const counts = Array.from({ length: 13 }, () => 0);
  for (const p of monthlySeries) {
    const m = ((p.month - 1) % 12) + 1;
    factors[m] += p.value;
    counts[m] += 1;
  }
  const overall =
    monthlySeries.length > 0 ? mean(monthlySeries.map((x) => x.value)) : 1;
  const out = Array.from({ length: 13 }, () => 1);
  if (overall <= 0) return out;
  for (let m = 1; m <= 12; m++) {
    if (counts[m] > 0) out[m] = factors[m] / counts[m] / overall;
  }
  return out;
}

export function factorForCalendarMonth(factors: number[], calendarMonth: number): number {
  const m = Math.min(12, Math.max(1, Math.round(calendarMonth)));
  const f = factors[m];
  return f > 0 ? f : 1;
}
