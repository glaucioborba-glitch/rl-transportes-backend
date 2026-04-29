import {
  analisarEquilibrioOperacional,
  construirCapexPlanejado,
  construirForecastFinanceiro,
  projetarDemanda12Meses,
  projetarOpex12Meses,
  simularCenarioEstrategico,
} from './planejamento-estrategico.calculations';

describe('planejamento-estrategico.calculations', () => {
  it('projetarDemanda12Meses devolve 12 meses', () => {
    const hist = [
      { mes: '2025-01', valor: 100 },
      { mes: '2025-02', valor: 110 },
      { mes: '2025-03', valor: 105 },
    ];
    const r = projetarDemanda12Meses(hist);
    expect(r.volumePrevisto).toHaveLength(12);
    expect(['crescimento', 'estavel', 'declinio']).toContain(r.tendencia);
  });

  it('projetarDemanda12Meses sem histórico retorna série zerada', () => {
    const r = projetarDemanda12Meses([]);
    expect(r.volumePrevisto.every((x) => x.valor === 0)).toBe(true);
  });

  it('construirForecastFinanceiro monta três cenários', () => {
    const r = construirForecastFinanceiro(
      [
        { mes: '2025-01', valor: 10000 },
        { mes: '2025-02', valor: 11000 },
      ],
      20,
      -0.3,
      4,
    );
    expect(r.otimista.receitaTotal).toBeGreaterThan(r.pessimista.receitaTotal);
    expect(r.base.receitaTotal).toBeGreaterThan(0);
  });

  it('projetarOpex12Meses retorna 12 custos', () => {
    const r = projetarOpex12Meses({
      custoPorOperacaoProxy: 40,
      operacoesMesMedio: 500,
      custoTurnoFixoMensal: 30000,
      custoPorOperadorMes: 7000,
      numOperadoresEquivalentes: 8,
      custoPatioVariavelPorPctOcupacao: 15000,
      ocupacaoMediaPct: 55,
    });
    expect(r.custoMensalPrevisto).toHaveLength(12);
    expect(r.custoPorUnidade).toBeGreaterThan(0);
  });

  it('construirCapexPlanejado calcula ROI em meses', () => {
    const r = construirCapexPlanejado(40, 9000, 700, 36);
    expect(r.linhas.length).toBe(3);
    expect(r.roiMeses12).not.toBeNull();
  });

  it('analisarEquilibrioOperacional identifica expansão benéfica ao custo', () => {
    const r = analisarEquilibrioOperacional({
      capacidadeSlotsTotal: 200,
      demandaPrevistaMediaMensal: 220,
      custoPorUnidadeAtual: 120,
      custoPorUnidadeAposExpansaoProxy: 100,
    });
    expect(r.expansaoReduzCustoPorUnidade).toBe(true);
  });

  it('simularCenarioEstrategico aumenta risco com demanda forte', () => {
    const alto = simularCenarioEstrategico({
      aumentoDemandaPct: 40,
      reducaoTurnoHoras: 8,
      aumentoTurnoHoras: 0,
      expansaoSlots: 0,
      investimentoAdicional: 0,
      receitaBaseAnual: 1_000_000,
      margemPctBase: 22,
      capacidadeSlots: 200,
    });
    expect(alto.riscoOperacional).toBe('alto');
  });
});
