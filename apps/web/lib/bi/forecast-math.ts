/** Regressão linear y ~ a + b*x sobre x = 0..n-1 */
export function linearRegression(y: number[]): { a: number; b: number } {
  const n = y.length;
  if (n < 2) return { a: y[0] ?? 0, b: 0 };
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    sx += i;
    sy += y[i]!;
    sxx += i * i;
    sxy += i * y[i]!;
  }
  const den = n * sxx - sx * sx;
  if (Math.abs(den) < 1e-9) return { a: sy / n, b: 0 };
  const b = (n * sxy - sx * sy) / den;
  const a = (sy - b * sx) / n;
  return { a, b };
}

export function movingAverage(y: number[], window: number): number[] {
  if (window < 1) return [...y];
  const out: number[] = [];
  for (let i = 0; i < y.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = y.slice(start, i + 1);
    out.push(slice.reduce((s, v) => s + v, 0) / slice.length);
  }
  return out;
}

export function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  const v = values.reduce((s, x) => s + (x - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(v);
}

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo);
}

/** Projeta pontos futuros x = n..n+horizon-1 usando reta a+b*x */
export function extrapolateLinear(a: number, b: number, startIndex: number, horizon: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < horizon; i++) {
    const x = startIndex + i;
    out.push(Math.max(0, a + b * x));
  }
  return out;
}
