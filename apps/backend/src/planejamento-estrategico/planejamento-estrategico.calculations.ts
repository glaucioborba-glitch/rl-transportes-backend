/**
 * Planejamento estratégico — funções puras (forecast, cenários, OPEX/CAPEX proxy).
 * Premissas financeiras configuráveis por ambiente no service.
 */

export type TendenciaDemanda = 'crescimento' | 'estavel' | 'declinio';

export interface MesValor {
  mes: string;
  valor: number;
}

/** Holt-Winters simplificado: nível + tendência + sazonalidade por índice de mês (1–12). */
export function sazonalidadePorMes(historicoMensal: MesValor[]): Map<number, number> {
  const byMonth = new Map<number, number[]>();
  for (const row of historicoMensal) {
    const monthNum = parseInt(row.mes.slice(5, 7), 10);
    if (!byMonth.has(monthNum)) byMonth.set(monthNum, []);
    byMonth.get(monthNum)!.push(row.valor);
  }
  const globalAvg =
    historicoMensal.length > 0
      ? historicoMensal.reduce((s, x) => s + x.valor, 0) / historicoMensal.length
      : 1;
  const factors = new Map<number, number>();
  for (let m = 1; m <= 12; m++) {
    const vals = byMonth.get(m) ?? [];
    const local = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : globalAvg;
    factors.set(m, globalAvg > 0 ? local / globalAvg : 1);
  }
  return factors;
}

export function tendenciaLinearSerie(values: number[]): { slope: number; nivel: number } {
  const n = values.length;
  if (n < 2) return { slope: 0, nivel: values[0] ?? 0 };
  let sx = 0;
  let sy = 0;
  let sxy = 0;
  let sx2 = 0;
  for (let i = 0; i < n; i++) {
    sx += i;
    sy += values[i];
    sxy += i * values[i];
    sx2 += i * i;
  }
  const denom = n * sx2 - sx * sx || 1;
  const slope = (n * sxy - sx * sy) / denom;
  const nivel = (sy - slope * sx) / n;
  return { slope, nivel };
}

/** Projeta 12 meses a partir do último nível histórico + tendência + sazonalidade. */
export function projetarDemanda12Meses(
  historicoMensalOrdenado: MesValor[],
): { volumePrevisto: MesValor[]; confiancaPct: number; tendencia: TendenciaDemanda } {
  if (!historicoMensalOrdenado.length) {
    const volumePrevisto: MesValor[] = [];
    const baseMonth = new Date();
    for (let k = 1; k <= 12; k++) {
      const d = new Date(baseMonth.getFullYear(), baseMonth.getMonth() + k, 1);
      const mesStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      volumePrevisto.push({ mes: mesStr, valor: 0 });
    }
    return { volumePrevisto, confiancaPct: 28, tendencia: 'estavel' };
  }

  const vals = historicoMensalOrdenado.map((x) => x.valor);
  const { slope, nivel } = tendenciaLinearSerie(vals.length >= 3 ? vals : [...vals, ...(vals[0] !== undefined ? [vals[0]] : [1])]);
  const seas = sazonalidadePorMes(historicoMensalOrdenado);

  const lastIdx = Math.max(0, vals.length - 1);
  const ref = vals[lastIdx] ?? 1;
  const tendencia: TendenciaDemanda =
    slope > ref * 0.008 ? 'crescimento' : slope < -ref * 0.008 ? 'declinio' : 'estavel';

  const baseMonth = new Date();
  const volumePrevisto: MesValor[] = [];
  for (let k = 1; k <= 12; k++) {
    const d = new Date(baseMonth.getFullYear(), baseMonth.getMonth() + k, 1);
    const mesStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthNum = d.getMonth() + 1;
    const t = lastIdx + k;
    const raw = Math.max(0, nivel + slope * t);
    const fator = seas.get(monthNum) ?? 1;
    const v = Math.round(raw * fator * 100) / 100;
    volumePrevisto.push({ mes: mesStr, valor: v });
  }

  const confiancaPct = Math.min(92, Math.max(28, 35 + historicoMensalOrdenado.length * 1.2));

  return { volumePrevisto, confiancaPct: Math.round(confiancaPct * 10) / 10, tendencia };
}

export interface CenarioFinanceiroAnual {
  receitaTotalPrevista: number;
  margemTotalPrevista: number;
  mesAMes: MesValor[];
  otimista: { receitaTotal: number; margemTotal: number };
  base: { receitaTotal: number; margemTotal: number };
  pessimista: { receitaTotal: number; margemTotal: number };
}

export function construirForecastFinanceiro(
  receitaHistoricaMensal: MesValor[],
  margemMediaPct: number,
  elasticidadeDemandaProxy: number,
  crescimentoEsperadoPctAnual: number,
): CenarioFinanceiroAnual {
  const vals = receitaHistoricaMensal.map((x) => x.valor);
  const { slope, nivel } = tendenciaLinearSerie(vals.length >= 2 ? vals : [vals[0] ?? 0, vals[0] ?? 1]);
  const lastIdx = Math.max(0, vals.length - 1);
  const seas = sazonalidadePorMes(receitaHistoricaMensal);
  const growthFator = 1 + crescimentoEsperadoPctAnual / 100;

  const baseMonth = new Date();
  const mesAMes: MesValor[] = [];
  let receitaTotalPrevista = 0;

  for (let k = 1; k <= 12; k++) {
    const d = new Date(baseMonth.getFullYear(), baseMonth.getMonth() + k, 1);
    const mesStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthNum = d.getMonth() + 1;
    const t = lastIdx + k;
    let receita = Math.max(0, (nivel + slope * t) * (seas.get(monthNum) ?? 1) * growthFator);
    receita = Math.round(receita * 100) / 100;
    mesAMes.push({ mes: mesStr, valor: receita });
    receitaTotalPrevista += receita;
  }

  const margemPctEfetiva = Math.max(5, Math.min(55, margemMediaPct + elasticidadeDemandaProxy * 3));
  const margemTotalPrevista = Math.round(receitaTotalPrevista * (margemPctEfetiva / 100) * 100) / 100;

  const spread = 0.08;
  const otimistaReceita = receitaTotalPrevista * (1 + spread);
  const pessimistaReceita = receitaTotalPrevista * (1 - spread);

  return {
    receitaTotalPrevista: Math.round(receitaTotalPrevista * 100) / 100,
    margemTotalPrevista,
    mesAMes,
    otimista: {
      receitaTotal: Math.round(otimistaReceita * 100) / 100,
      margemTotal: Math.round(otimistaReceita * (margemPctEfetiva / 100) * 100) / 100,
    },
    base: {
      receitaTotal: Math.round(receitaTotalPrevista * 100) / 100,
      margemTotal: margemTotalPrevista,
    },
    pessimista: {
      receitaTotal: Math.round(pessimistaReceita * 100) / 100,
      margemTotal: Math.round(pessimistaReceita * (margemPctEfetiva / 100) * 100) / 100,
    },
  };
}

export interface OpexInput {
  custoPorOperacaoProxy: number;
  operacoesMesMedio: number;
  custoTurnoFixoMensal: number;
  custoPorOperadorMes: number;
  numOperadoresEquivalentes: number;
  custoPatioVariavelPorPctOcupacao: number;
  ocupacaoMediaPct: number;
}

export function projetarOpex12Meses(inp: OpexInput): { custoMensalPrevisto: MesValor[]; custoPorUnidade: number } {
  const base =
    inp.custoPorOperacaoProxy * inp.operacoesMesMedio +
    inp.custoTurnoFixoMensal +
    inp.custoPorOperadorMes * inp.numOperadoresEquivalentes +
    inp.custoPatioVariavelPorPctOcupacao * (inp.ocupacaoMediaPct / 100);

  const custoMensalPrevisto: MesValor[] = [];
  const now = new Date();
  const volMed =
    inp.operacoesMesMedio > 0 ? base / Math.max(1, inp.operacoesMesMedio) : base;

  for (let k = 1; k <= 12; k++) {
    const d = new Date(now.getFullYear(), now.getMonth() + k, 1);
    const mesStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const seasonalBump = 1 + 0.04 * Math.sin((k / 12) * Math.PI * 2);
    const v = Math.round(base * seasonalBump * 100) / 100;
    custoMensalPrevisto.push({ mes: mesStr, valor: v });
  }

  const custoPorUnidade = Math.round(volMed * 100) / 100;
  return { custoMensalPrevisto, custoPorUnidade };
}

export interface CapexLinha {
  categoria: string;
  investimentoEstimado: number;
  capacidadeAdicionalSlots: number;
}

export interface CapexResultado {
  linhas: CapexLinha[];
  investimentoTotal: number;
  capacidadeAdicionalTotalSlots: number;
  roiMeses12: number | null;
  roiMeses24: number | null;
  roiMeses36: number | null;
}

export function construirCapexPlanejado(
  expansaoSlotsPlanejados: number,
  margemPorSlotAnualProxy: number,
  custoPorSlotM2Proxy: number,
  m2PorSlot: number,
): CapexResultado {
  const patio = expansaoSlotsPlanejados * m2PorSlot * custoPorSlotM2Proxy;
  const portariaGate = patio * 0.22;
  const tecnologia = patio * 0.08;

  const linhas: CapexLinha[] = [
    { categoria: 'Expansão de pátio (infraestrutura)', investimentoEstimado: Math.round(patio), capacidadeAdicionalSlots: expansaoSlotsPlanejados },
    { categoria: 'Portaria / Gate / equipamentos', investimentoEstimado: Math.round(portariaGate), capacidadeAdicionalSlots: 0 },
    { categoria: 'Tecnologia (OCR, IA, mobilidade)', investimentoEstimado: Math.round(tecnologia), capacidadeAdicionalSlots: 0 },
  ];

  const investimentoTotal = linhas.reduce((s, x) => s + x.investimentoEstimado, 0);
  const capacidadeAdicionalTotalSlots = expansaoSlotsPlanejados;

  const fluxoAnualMargem = expansaoSlotsPlanejados * margemPorSlotAnualProxy;
  const fluxoMensal = fluxoAnualMargem / 12;
  const roiMeses12 =
    investimentoTotal > 0 && fluxoMensal > 0 ? Math.round((investimentoTotal / fluxoMensal) * 10) / 10 : null;
  const roiMeses24 =
    investimentoTotal > 0 && fluxoMensal > 0
      ? Math.round((investimentoTotal / (fluxoMensal * 1.05)) * 10) / 10
      : null;
  const roiMeses36 =
    investimentoTotal > 0 && fluxoMensal > 0
      ? Math.round((investimentoTotal / (fluxoMensal * 1.1)) * 10) / 10
      : null;

  return {
    linhas,
    investimentoTotal,
    capacidadeAdicionalTotalSlots,
    roiMeses12,
    roiMeses24,
    roiMeses36,
  };
}

export interface EquilibrioInput {
  capacidadeSlotsTotal: number;
  demandaPrevistaMediaMensal: number;
  custoPorUnidadeAtual: number;
  custoPorUnidadeAposExpansaoProxy: number;
}

export interface EquilibrioResultado {
  mesesAteDeficitCapacidade: number | null;
  expansaoReduzCustoPorUnidade: boolean;
  sweetSpotOcupacaoPct: number;
  observacao: string;
}

export function analisarEquilibrioOperacional(inp: EquilibrioInput): EquilibrioResultado {
  const margem =
    inp.demandaPrevistaMediaMensal > inp.capacidadeSlotsTotal
      ? inp.demandaPrevistaMediaMensal - inp.capacidadeSlotsTotal
      : 0;
  const mesesAteDeficitCapacidade =
    margem > 0 ? Math.max(1, Math.ceil(12 / Math.max(0.5, margem / inp.capacidadeSlotsTotal))) : null;

  const expansaoReduzCustoPorUnidade = inp.custoPorUnidadeAposExpansaoProxy < inp.custoPorUnidadeAtual * 0.98;
  const sweetSpotOcupacaoPct = 78;

  let observacao =
    'Capacidade alinhada à demanda projetada no horizonte considerado.';
  if (margem > inp.capacidadeSlotsTotal * 0.05) {
    observacao =
      'Demanda média mensal projetada supera a capacidade declarada — revisar expansão física ou política comercial.';
  }
  if (expansaoReduzCustoPorUnidade) {
    observacao += ' Expansão amortizada tende a diluir custo operacional por unidade.';
  }

  return {
    mesesAteDeficitCapacidade,
    expansaoReduzCustoPorUnidade,
    sweetSpotOcupacaoPct,
    observacao,
  };
}

export interface CenarioEstrategicoInput {
  aumentoDemandaPct: number;
  reducaoTurnoHoras: number;
  aumentoTurnoHoras: number;
  expansaoSlots: number;
  investimentoAdicional: number;
  receitaBaseAnual: number;
  margemPctBase: number;
  capacidadeSlots: number;
}

export interface CenarioEstrategicoResultado {
  impactoEmReceitaPct: number;
  impactoEmMargemPctPontos: number;
  impactoEmCapacidadePctPontos: number;
  riscoOperacional: 'baixo' | 'medio' | 'alto';
  recomendacaoExecutiva: string;
}

export function simularCenarioEstrategico(inp: CenarioEstrategicoInput): CenarioEstrategicoResultado {
  const dem = 1 + inp.aumentoDemandaPct / 100;
  const turnoNet = inp.aumentoTurnoHoras - inp.reducaoTurnoHoras;
  const turnoFator = Math.max(0.72, Math.min(1.25, 1 + turnoNet / 72));

  const capExtra = inp.expansaoSlots / Math.max(1, inp.capacidadeSlots);
  const capImpPct = Math.round(capExtra * 100 * 10) / 10;

  const receitaNova = inp.receitaBaseAnual * dem * turnoFator + inp.investimentoAdicional * 0.02;
  const impactoRecPct =
    inp.receitaBaseAnual > 0 ? Math.round(((receitaNova - inp.receitaBaseAnual) / inp.receitaBaseAnual) * 1000) / 10 : 0;

  const margNova = Math.max(
    8,
    Math.min(
      48,
      inp.margemPctBase + (dem - 1) * 12 + (turnoNet < 0 ? -2.5 : turnoNet > 0 ? 1.2 : 0),
    ),
  );
  const impactoMargPontos = Math.round((margNova - inp.margemPctBase) * 10) / 10;

  let riscoOperacional: 'baixo' | 'medio' | 'alto' = 'baixo';
  if (dem > 1.22 || turnoNet < -4) riscoOperacional = 'alto';
  else if (dem > 1.1 || turnoNet < -2) riscoOperacional = 'medio';

  let recomendacaoExecutiva =
    'Manter monitoramento mensal de ocupação e sincronizar expansão física com forecast comercial.';
  if (inp.expansaoSlots > 0 && inp.investimentoAdicional > 0) {
    recomendacaoExecutiva =
      'Priorizar projeto em ondas: primeiro liberar capacidade crítica (pátio/gate), depois tecnologia.';
  }
  if (riscoOperacional === 'alto') {
    recomendacaoExecutiva =
      'Alto descompasso demanda × capacidade ou turno — acionar comitê executivo e contingência operacional.';
  }

  return {
    impactoEmReceitaPct: impactoRecPct,
    impactoEmMargemPctPontos: impactoMargPontos,
    impactoEmCapacidadePctPontos: capImpPct,
    riscoOperacional,
    recomendacaoExecutiva,
  };
}

