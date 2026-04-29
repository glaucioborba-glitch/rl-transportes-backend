import { logisticScore, sigmoid } from './score-logistic';

describe('score-logistic (inadimplência)', () => {
  it('sigmoid mapeia score em probabilidade', () => {
    expect(sigmoid(0)).toBeCloseTo(0.5, 5);
    expect(sigmoid(4)).toBeGreaterThan(0.95);
  });

  it('logisticScore combina features com pesos', () => {
    const z = logisticScore([1, -1, 0.5], [2, 2, 2]);
    expect(z).toBe(1);
  });
});
