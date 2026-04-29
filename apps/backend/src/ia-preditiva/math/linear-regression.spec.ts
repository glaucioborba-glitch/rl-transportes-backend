import { fitLinear, mean, stdDev } from './linear-regression';

describe('linear-regression', () => {
  it('fitLinear recupera tendência y ≈ 2x + 1', () => {
    const xs = [0, 1, 2, 3];
    const ys = [1, 3, 5, 7];
    const { a, b, r2 } = fitLinear(xs, ys);
    expect(a).toBeCloseTo(1, 5);
    expect(b).toBeCloseTo(2, 5);
    expect(r2).toBeGreaterThan(0.99);
  });

  it('stdDev detecta outliers para score z', () => {
    const base = [10, 11, 10.5, 10.8, 11.2];
    const mu = mean(base);
    const sigma = stdDev(base);
    const z = Math.abs((100 - mu) / sigma);
    expect(z).toBeGreaterThan(3);
  });
});
