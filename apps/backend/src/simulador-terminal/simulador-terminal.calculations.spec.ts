import {
  expansaoRoiOperacionalProxy,
  fatorSaturacao,
  projetarSeriesPorHorizonte,
  simularCenarioWhatIf,
} from './simulador-terminal.calculations';

describe('simulador-terminal.calculations', () => {
  it('fatorSaturacao calcula percentual', () => {
    expect(fatorSaturacao(50, 200)).toBe(25);
    expect(fatorSaturacao(0, 100)).toBe(0);
  });

  it('projetarSeriesPorHorizonte retorna métricas coerentes', () => {
    const s = Array.from({ length: 10 }, (_, i) => 20 + i);
    const p = projetarSeriesPorHorizonte(s, 55, 4.2, 5.1, 14);
    expect(p.saturacaoPatioPrevistaPct).toBeGreaterThanOrEqual(0);
    expect(p.throughputGatePrevistoUph).toBeGreaterThanOrEqual(0);
  });

  it('simularCenarioWhatIf altera saturação quando demanda sobe', () => {
    const base = simularCenarioWhatIf({
      aumentoDemandaPercentual: 0,
      reducaoTurnoHoras: 0,
      aumentoTurnoHoras: 0,
      expansaoQuadras: 0,
      novoClienteVolumeEstimado: 0,
      slotsPorQuadra: 40,
      capacidadeTotalSlots: 200,
      ocupacaoAtualUnidades: 120,
      throughputGateBaseUph: 5,
      cicloMedioMinutosBase: 200,
    });
    const alt = simularCenarioWhatIf({
      aumentoDemandaPercentual: 25,
      reducaoTurnoHoras: 0,
      aumentoTurnoHoras: 0,
      expansaoQuadras: 0,
      novoClienteVolumeEstimado: 0,
      slotsPorQuadra: 40,
      capacidadeTotalSlots: 200,
      ocupacaoAtualUnidades: 120,
      throughputGateBaseUph: 5,
      cicloMedioMinutosBase: 200,
    });
    expect(alt.saturacaoResultantePct).toBeGreaterThan(base.saturacaoResultantePct);
  });

  it('expansaoRoiOperacionalProxy reduz saturação quando há ganho de slots', () => {
    const r = expansaoRoiOperacionalProxy({
      quadrasAdicionais: 2,
      slotsPorQuadra: 40,
      ocupacaoAtualUnidades: 160,
      capacidadeTotalSlotsAtual: 200,
      custoExpansaoPorM2Proxy: 800,
      margemOperacionalPorSlotProxy: 100,
      m2PorSlotProxy: 36,
    });
    expect(r.ganhoSlots).toBe(80);
    expect(r.saturacaoAposExpansaoPct).toBeLessThan(r.saturacaoAtualPct);
    expect(r.roiOperacionalProxy).toBeGreaterThan(0);
  });
});
