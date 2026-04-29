import { preverDemandaVolume } from './demanda.engine';

describe('demanda.engine', () => {
  const mensal = Array.from({ length: 18 }).map((_, i) => {
    const d = new Date(Date.UTC(2024, i % 12, 1));
    return { periodo: d, volume: 20 + i * 0.6 + Math.sin(i / 3) * 3 };
  });

  it('preverDemandaVolume produz quatro horizontes com tendência e confiança', () => {
    const out = preverDemandaVolume({
      mensal,
      horizontesDias: [7, 30, 90, 180],
      sesAlpha: 0.35,
      blendTrend: 0.62,
    });
    expect(out.porHorizonte['7']).toBeDefined();
    expect(out.porHorizonte['180']).toBeDefined();
    expect(out.porHorizonte['30'].confiancaPct).toBeGreaterThanOrEqual(40);
    expect(['alta', 'estavel', 'baixa']).toContain(out.porHorizonte['90'].tendencia);
  });
});
