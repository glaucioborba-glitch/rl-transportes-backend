import {
  previsoesGargaloPorHorizontes,
  previsaoCicloMinutos,
  probabilidadeGargaloEtapa,
  recomendarBalanceamentoPatio,
} from './ia-operacional.calculations';

describe('ia-operacional.calculations', () => {
  it('probabilidadeGargaloEtapa mantém resultado entre 0 e 1', () => {
    const samples = Array.from({ length: 40 }, (_, i) => 30 + i * 2);
    expect(probabilidadeGargaloEtapa(samples, 2)).toBeGreaterThanOrEqual(0);
    expect(probabilidadeGargaloEtapa(samples, 2)).toBeLessThanOrEqual(1);
    expect(probabilidadeGargaloEtapa(samples, 8)).toBeLessThanOrEqual(1);
  });

  it('previsoesGargaloPorHorizontes devolve 2h, 4h e 8h', () => {
    const series = {
      portaria: [12, 15, 20],
      gate: [8, 10, 9],
      patio: [45, 50, 55],
      saida: [15, 16, 14],
    };
    const h = previsoesGargaloPorHorizontes(series);
    expect(h).toHaveLength(3);
    expect(h.map((x) => x.horas)).toEqual([2, 4, 8]);
  });

  it('previsaoCicloMinutos usa defaults quando sem dados', () => {
    const p = previsaoCicloMinutos([]);
    expect(p.previstoMinutos).toBeGreaterThan(0);
    expect(p.bandaInferiorMinutos).toBeLessThanOrEqual(p.bandaSuperiorMinutos);
  });

  it('recomendarBalanceamentoPatio sugere origem→destino quando há hotspots', () => {
    const out = recomendarBalanceamentoPatio({
      Q1: 80,
      Q2: 20,
      Q3: 25,
    });
    expect(out.length).toBeGreaterThanOrEqual(1);
    expect(out[0]).toHaveProperty('quadraOrigem');
    expect(out[0]).toHaveProperty('quadraDestino');
  });
});
