/** Motor analítico do simulador (determinístico; sem alterar dados persistidos). */

export type HorizonteProjecaoDias = 7 | 14 | 30;

export interface ProjecaoHorizonteDto {
  dias: HorizonteProjecaoDias;
  saturacaoPatioPrevistaPct: number;
  demandaPortariaPrevistaUph: number;
  throughputGatePrevistoUph: number;
  confiancaPct: number;
}

export interface CenarioWhatIfInput {
  aumentoDemandaPercentual: number;
  reducaoTurnoHoras: number;
  aumentoTurnoHoras: number;
  expansaoQuadras: number;
  novoClienteVolumeEstimado: number;
  slotsPorQuadra: number;
  capacidadeTotalSlots: number;
  ocupacaoAtualUnidades: number;
  throughputGateBaseUph: number;
  cicloMedioMinutosBase: number;
}

export interface CenarioWhatIfResultado {
  impactoNaSaturacaoPctPontos: number;
  saturacaoResultantePct: number;
  impactoNoCicloMinutos: number;
  cicloResultanteMinutos: number;
  necessidadeExpansaoSlots: number;
  necessidadeExpansaoM2Estimada: number;
  throughputEsperadoUph: number;
  gargalosProvaveis: string[];
}

export interface ExpansaoParametros {
  quadrasAdicionais: number;
  slotsPorQuadra: number;
  ocupacaoAtualUnidades: number;
  capacidadeTotalSlotsAtual: number;
  custoExpansaoPorM2Proxy: number;
  margemOperacionalPorSlotProxy: number;
  m2PorSlotProxy: number;
}

export interface ExpansaoResultado {
  ganhoSlots: number;
  novaCapacidadeTotalSlots: number;
  saturacaoAtualPct: number;
  saturacaoAposExpansaoPct: number;
  reducaoSaturacaoPctPontos: number;
  impactoCicloMinutosEstimado: number;
  roiOperacionalProxy: number;
  mesesPaybackProxy: number | null;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** Fator de saturação 0–100%. */
export function fatorSaturacao(ocupacao: number, capacidade: number): number {
  if (capacidade <= 0) return ocupacao > 0 ? 100 : 0;
  return clamp((ocupacao / capacidade) * 100, 0, 999);
}

/** Tendência linear simples (mínimos quadrados). */
export function tendenciaLinear(xs: number[]): { slope: number; intercept: number } {
  const n = xs.length;
  if (n < 2) return { slope: 0, intercept: xs[0] ?? 0 };
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += xs[i];
    sumXY += i * xs[i];
    sumX2 += i * i;
  }
  const denom = n * sumX2 - sumX * sumX || 1;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

/** Projeção por horizonte (proxy único para pátio e gate). */
export function projetarSeriesPorHorizonte(
  demandaDiariaMedia: number[],
  ocupacaoSnapshotPct: number,
  throughputGateHistUph: number,
  throughputPortariaHistUph: number,
  horizonte: HorizonteProjecaoDias,
): Omit<ProjecaoHorizonteDto, 'dias'> {
  const serie =
    demandaDiariaMedia.length >= 3
      ? demandaDiariaMedia
      : [demandaDiariaMedia[0] ?? 0, demandaDiariaMedia[0] ?? 0.001];
  const td = tendenciaLinear(serie);
  const diasAhead = horizonte - 1;
  const ultimoIdx = serie.length - 1;
  const demandaAlvo = Math.max(0, td.intercept + td.slope * (ultimoIdx + diasAhead));
  const base = serie.reduce((a, b) => a + b, 0) / serie.length;
  const fatorDemanda = base > 0 ? demandaAlvo / base : 1;

  const saturacaoPrevista = clamp(ocupacaoSnapshotPct * fatorDemanda * (1 + horizonte / 200), 0, 150);
  const gatePrev = clamp(throughputGateHistUph * (1 + (fatorDemanda - 1) * 0.85), 0, 500);
  const portPrev = clamp(throughputPortariaHistUph * (1 + (fatorDemanda - 1) * 0.9), 0, 500);

  const confiancaPct = clamp(52 + serie.length * 1.05 - horizonte * 0.38, 22, 94);

  return {
    saturacaoPatioPrevistaPct: Math.round(saturacaoPrevista * 10) / 10,
    demandaPortariaPrevistaUph: Math.round(portPrev * 100) / 100,
    throughputGatePrevistoUph: Math.round(gatePrev * 100) / 100,
    confiancaPct: Math.round(confiancaPct * 10) / 10,
  };
}

/** Simulação What-If agregada. */
export function simularCenarioWhatIf(i: CenarioWhatIfInput): CenarioWhatIfResultado {
  const demFactor = 1 + i.aumentoDemandaPercentual / 100;
  const horasDiaEfetivas = 24 + i.aumentoTurnoHoras - i.reducaoTurnoHoras;
  const turnoFactor = clamp(horasDiaEfetivas / 24, 0.55, 1.35);

  const extraSlots = Math.max(0, i.expansaoQuadras) * Math.max(1, i.slotsPorQuadra);
  const capacidadeNova = Math.max(1, i.capacidadeTotalSlots + extraSlots);

  const influxoMensalExtra = i.novoClienteVolumeEstimado;
  const ocupacaoProjetada =
    i.ocupacaoAtualUnidades * demFactor + influxoMensalExtra / 30;

  const satResult = fatorSaturacao(ocupacaoProjetada, capacidadeNova);
  const satAtualPct = fatorSaturacao(i.ocupacaoAtualUnidades, i.capacidadeTotalSlots);
  const impactoSatPontos = Math.round((satResult - satAtualPct) * 10) / 10;

  const cicloStretch =
    1 + Math.max(0, demFactor - 1) * 0.35 + Math.max(0, satResult / 100 - 0.75) * 0.42;
  const cicloResult =
    i.cicloMedioMinutosBase *
    cicloStretch *
    (turnoFactor < 1 ? 1 / Math.max(0.55, turnoFactor) : 1 / turnoFactor);
  const impactoCiclo = Math.round((cicloResult - i.cicloMedioMinutosBase) * 10) / 10;

  const limiarOperativo = capacidadeNova * 0.88;
  const slotsNecessarios = Math.max(0, Math.ceil(ocupacaoProjetada - limiarOperativo));
  const m2PorSlot = 36;

  const thrGate =
    i.throughputGateBaseUph *
    demFactor *
    Math.min(1.12, turnoFactor) *
    (1 - Math.min(0.1, extraSlots / Math.max(200, capacidadeNova)));

  const gargalos: string[] = [];
  if (satResult > 92) gargalos.push('Pátio próximo do limite — escoamento ou expansão física.');
  if (demFactor > 1.18) gargalos.push('Demanda elevada pressiona filas na portaria.');
  if (i.reducaoTurnoHoras > i.aumentoTurnoHoras + 0.01)
    gargalos.push('Redução líquida de horas por dia pode afunilar throughput no gate.');
  if (thrGate < i.throughputGateBaseUph * 0.92) gargalos.push('Gate pode tornar-se restritivo no cenário.');
  if (!gargalos.length) gargalos.push('Sem indício forte de gargalo único no cenário.');

  return {
    impactoNaSaturacaoPctPontos: impactoSatPontos,
    saturacaoResultantePct: Math.round(satResult * 10) / 10,
    impactoNoCicloMinutos: impactoCiclo,
    cicloResultanteMinutos: Math.round(cicloResult * 10) / 10,
    necessidadeExpansaoSlots: slotsNecessarios,
    necessidadeExpansaoM2Estimada: slotsNecessarios * m2PorSlot,
    throughputEsperadoUph: Math.round(thrGate * 100) / 100,
    gargalosProvaveis: gargalos,
  };
}

/** ROI operacional proxy (margem acumulada / custo — valor interpretável apenas como ranking interno). */
export function expansaoRoiOperacionalProxy(p: ExpansaoParametros): ExpansaoResultado {
  const ganhoSlots = Math.max(0, p.quadrasAdicionais) * Math.max(1, p.slotsPorQuadra);
  const capNova = Math.max(1, p.capacidadeTotalSlotsAtual + ganhoSlots);
  const satAtualPct = fatorSaturacao(p.ocupacaoAtualUnidades, p.capacidadeTotalSlotsAtual);
  const satNovaPct = fatorSaturacao(p.ocupacaoAtualUnidades, capNova);
  const reducaoSat = Math.round((satAtualPct - satNovaPct) * 10) / 10;

  const impactoCiclo =
    ganhoSlots > 0 ? Math.round(-Math.min(45, ganhoSlots * 0.06) * 10) / 10 : 0;

  const custoTotal = ganhoSlots * p.m2PorSlotProxy * p.custoExpansaoPorM2Proxy;
  const margemAnualExtra = ganhoSlots * p.margemOperacionalPorSlotProxy * 12;
  const roi = custoTotal > 0 ? margemAnualExtra / custoTotal : 0;
  const mesesPayback =
    margemAnualExtra > 0 && custoTotal > 0 ? Math.round((custoTotal / (margemAnualExtra / 12)) * 10) / 10 : null;

  return {
    ganhoSlots,
    novaCapacidadeTotalSlots: capNova,
    saturacaoAtualPct: Math.round(satAtualPct * 10) / 10,
    saturacaoAposExpansaoPct: Math.round(satNovaPct * 10) / 10,
    reducaoSaturacaoPctPontos: reducaoSat,
    impactoCicloMinutosEstimado: impactoCiclo,
    roiOperacionalProxy: Math.round(roi * 100) / 100,
    mesesPaybackProxy: mesesPayback,
  };
}

/** Produtividade relativa por turno para cenários de abrir/fechar faixa. */
export function simularEfeitoTurnos(
  produtividadePorTurno: Record<string, number>,
  reducaoTurnoChave: string | null,
  aumentoTurnoChave: string | null,
): { baseline: number; ajustado: number; deltaPct: number } {
  const vals = Object.values(produtividadePorTurno);
  const baseline = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 1;
  let fator = 1;
  if (reducaoTurnoChave && produtividadePorTurno[reducaoTurnoChave] !== undefined) {
    fator -= 0.12;
  }
  if (aumentoTurnoChave && produtividadePorTurno[aumentoTurnoChave] !== undefined) {
    fator += 0.1;
  }
  const ajustado = baseline * fator;
  return {
    baseline,
    ajustado,
    deltaPct: baseline > 0 ? Math.round(((ajustado - baseline) / baseline) * 1000) / 10 : 0,
  };
}
