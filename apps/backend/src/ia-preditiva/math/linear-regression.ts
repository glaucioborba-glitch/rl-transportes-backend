/** Regressão linear simples y ≈ a + b·x e coeficiente R². */
export function fitLinear(xs: number[], ys: number[]): { a: number; b: number; r2: number } {
  const n = xs.length;
  if (n < 2 || n !== ys.length) return { a: ys[0] ?? 0, b: 0, r2: 0 };
  let sx = 0,
    sy = 0,
    sxx = 0,
    sxy = 0;
  for (let i = 0; i < n; i++) {
    sx += xs[i];
    sy += ys[i];
    sxx += xs[i] * xs[i];
    sxy += xs[i] * ys[i];
  }
  const den = n * sxx - sx * sx;
  const b = den !== 0 ? (n * sxy - sx * sy) / den : 0;
  const a = (sy - b * sx) / n;

  let sse = 0,
    sst = 0;
  const my = sy / n;
  for (let i = 0; i < n; i++) {
    const pred = a + b * xs[i];
    sse += (ys[i] - pred) ** 2;
    sst += (ys[i] - my) ** 2;
  }
  const r2 = sst > 1e-12 ? 1 - sse / sst : 0;
  return { a, b, r2: Math.max(0, Math.min(1, r2)) };
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

export function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const v = values.reduce((s, x) => s + (x - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(v);
}
