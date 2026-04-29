/** σ(z) para scorecard → probabilidade em [0,1]. */
export function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

/** Combinação linear simples; pesos definidos pelo chamador. */
export function logisticScore(weights: number[], features: number[]): number {
  let z = 0;
  const n = Math.min(weights.length, features.length);
  for (let i = 0; i < n; i++) z += weights[i] * features[i];
  return z;
}
