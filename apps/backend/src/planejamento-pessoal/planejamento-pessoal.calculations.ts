/**
 * Planejamento de pessoal — funções puras (headcount, OPEX RH, cenários, contratação).
 */

import {
  type TurnoPlanejamentoPessoal,
  TurnoPlanejamentoPessoal as TurnoEnum,
  horasTurnoReferencia,
} from './planejamento-pessoal.turno';

export interface MesValor {
  mes: string;
  valor: number;
}

export interface HeadcountOtimoInput {
  demandaPrevistaDia: number;
  produtividadePorOperadorDia: number;
  headcountAtual: number;
}

export interface HeadcountOtimoResultado {
  headcountRecomendado: number;
  deficitOuExcessoAtual: number;
  tipoSaldo: 'deficit' | 'excesso' | 'equilibrado';
  produtividadeEstimadaEquipeRecomendada: number;
  riscoOperacionalPct: number;
}

/** Headcount ótimo operacional (proxy determinístico). */
export function calcHeadcountOtimo(inp: HeadcountOtimoInput): HeadcountOtimoResultado {
  const eps = 1e-9;
  const prod = Math.max(inp.produtividadePorOperadorDia, eps);
  const hcRec = Math.max(1, Math.ceil(inp.demandaPrevistaDia / prod));
  const deficitOuExcessoAtual = inp.headcountAtual - hcRec;
  let tipoSaldo: HeadcountOtimoResultado['tipoSaldo'] = 'equilibrado';
  if (deficitOuExcessoAtual < 0) tipoSaldo = 'deficit';
  else if (deficitOuExcessoAtual > 0) tipoSaldo = 'excesso';

  const falta = Math.max(0, hcRec - inp.headcountAtual);
  const riscoOperacionalPct = Math.min(
    100,
    Math.round((falta / Math.max(hcRec, 1)) * 1000) / 10,
  );

  return {
    headcountRecomendado: hcRec,
    deficitOuExcessoAtual,
    tipoSaldo,
    produtividadeEstimadaEquipeRecomendada: Math.round(hcRec * prod * 100) / 100,
    riscoOperacionalPct,
  };
}

export interface OrcamentoAnualPessoalInput {
  custoMensalBasePessoal: number[];
  coeficienteEncargos: number;
  custoHoraExtraProxyPct: number;
}

export interface OrcamentoAnualPessoalResultado {
  custoMensal: MesValor[];
  custoAnualPrevisto: number;
  deltaMesAMesPct: (number | null)[];
}

/** OPEX anual com encargos + proxy HE sobre série mensal de custo de pessoal. */
export function calcOrcamentoAnualPessoal(inp: OrcamentoAnualPessoalInput): OrcamentoAnualPessoalResultado {
  const meses = inp.custoMensalBasePessoal.length;
  const he = Math.max(0, inp.custoHoraExtraProxyPct / 100);
  const enc = Math.max(1, inp.coeficienteEncargos);

  const custoMensal: MesValor[] = [];
  const now = new Date();
  const valoresAjustados: number[] = [];

  for (let k = 0; k < meses; k++) {
    const d = new Date(now.getFullYear(), now.getMonth() + k + 1, 1);
    const mesStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const base = inp.custoMensalBasePessoal[k] ?? inp.custoMensalBasePessoal[inp.custoMensalBasePessoal.length - 1] ?? 0;
    const v = Math.round(base * enc * (1 + he) * 100) / 100;
    valoresAjustados.push(v);
    custoMensal.push({ mes: mesStr, valor: v });
  }

  const custoAnualPrevisto = Math.round(valoresAjustados.reduce((s, x) => s + x, 0) * 100) / 100;

  const deltaMesAMesPct: (number | null)[] = valoresAjustados.map((v, i) => {
    if (i === 0) return null;
    const prev = valoresAjustados[i - 1];
    if (prev === 0 || prev === undefined) return null;
    return Math.round(((v - prev) / prev) * 1000) / 10;
  });

  return { custoMensal, custoAnualPrevisto, deltaMesAMesPct };
}

export interface CenarioPessoalInput {
  contratar: number;
  demitir: number;
  volumeEstimadoNovoClienteMes: number;
  capacidadeBaseUnidadesMes: number;
  cicloMedioMinutosBase: number;
  custoPorOperadorHoraProxy: number;
  headcountProximoBase: number;
}

export interface CenarioPessoalResultado {
  impactoCapacidadeUnidadesMesPct: number;
  impactoCicloMinutos: number;
  impactoCustoPorHoraPct: number;
  requisitoTreinamentoHoras: number;
}

export function calcCenarioPessoal(inp: CenarioPessoalInput): CenarioPessoalResultado {
  const netHeads = inp.contratar - inp.demitir;
  const h = Math.max(1, inp.headcountProximoBase + netHeads);
  const capBase = Math.max(1, inp.capacidadeBaseUnidadesMes);
  const influxoPct = Math.min(0.42, inp.volumeEstimadoNovoClienteMes / capBase);
  const capBoost = 1 + Math.min(0.45, netHeads / Math.max(h, 1));
  const capacidadeNova = capBase * capBoost * (1 + influxoPct);
  const impactoCapacidadeUnidadesMesPct =
    capBase > 0
      ? Math.round(((capacidadeNova - capBase) / capBase) * 1000) / 10
      : 0;

  const cicloStretch =
    1 +
    Math.max(0, -netHeads) * 0.022 +
    influxoPct * 0.18 +
    Math.max(0, inp.volumeEstimadoNovoClienteMes > 0 ? 0.04 : 0);
  const cicloNovo = inp.cicloMedioMinutosBase * cicloStretch;
  const impactoCicloMinutos = Math.round((cicloNovo - inp.cicloMedioMinutosBase) * 10) / 10;

  const custoRel = inp.custoPorOperadorHoraProxy * (1 + Math.max(0, inp.contratar - inp.demitir) * 0.015);
  const impactoCustoPorHoraPct =
    inp.custoPorOperadorHoraProxy > 0
      ? Math.round(((custoRel - inp.custoPorOperadorHoraProxy) / inp.custoPorOperadorHoraProxy) * 1000) / 10
      : 0;

  const requisitoTreinamentoHoras = Math.round((inp.contratar * 40 + influxoPct * 120 + Math.abs(netHeads) * 8) * 10) / 10;

  return {
    impactoCapacidadeUnidadesMesPct,
    impactoCicloMinutos,
    impactoCustoPorHoraPct,
    requisitoTreinamentoHoras,
  };
}

export interface MatrizTurnoLinha {
  turno: TurnoPlanejamentoPessoal;
  produtividadeRelativa: number;
  custoProxyTurnoMensal: number;
  operadorHoraNecessarioMes: number;
  saturacaoPct: number;
}

/** Uma linha da matriz RH por turno (proxy a partir de auditoria + custos). */
export function linhaMatrizTurno(input: {
  turno: TurnoPlanejamentoPessoal;
  operacoesPeriodo: number;
  usuariosDistintos: number;
  diasPeriodo: number;
  custoOperadorMesProxy: number;
  capacidadeReferenciaMesUnidades: number;
}): MatrizTurnoLinha {
  const dias = Math.max(1, input.diasPeriodo);
  const u = Math.max(1, input.usuariosDistintos);
  const produtividadeRelativa = Math.round((input.operacoesPeriodo / u / dias) * 1000) / 1000;

  const shareTurno = input.turno === TurnoEnum.NOITE ? 1.08 : input.turno === TurnoEnum.TARDE ? 1.02 : 1;
  const custoProxyTurnoMensal = Math.round(input.custoOperadorMesProxy * u * shareTurno * 100) / 100;

  const diasUteisMes = 22;
  const horas = horasTurnoReferencia(input.turno);
  const operadorHoraNecessarioMes = Math.round(u * horas * diasUteisMes * 10) / 10;

  const throughputMesEstimado = (input.operacoesPeriodo / dias) * 30;
  const cap = Math.max(1, input.capacidadeReferenciaMesUnidades);
  const saturacaoPct = Math.min(
    130,
    Math.round((throughputMesEstimado / cap) * 1000) / 10,
  );

  return {
    turno: input.turno,
    produtividadeRelativa,
    custoProxyTurnoMensal,
    operadorHoraNecessarioMes,
    saturacaoPct,
  };
}

export interface ContratacaoProjecaoInput {
  demanda12Meses: number[];
  produtividadePorOperadorMes: number;
  headcountAtual: number;
  custoContratacaoPorHeadProxy: number;
  margemPorOperadorMesProxy: number;
}

export interface ContratacaoProjecaoResultado {
  previsaoContratar: number;
  previsaoTreinarHoras: number;
  riscoTurnoverPct: number;
  roiContratacaoProxy: number;
}

export function calcProjecaoContratacao(inp: ContratacaoProjecaoInput): ContratacaoProjecaoResultado {
  const demandaAnual = inp.demanda12Meses.reduce((s, x) => s + x, 0);
  const prodMes = Math.max(1e-6, inp.produtividadePorOperadorMes);
  const capacidadeAnualPorOperador = prodMes * 12;
  const headsNecessarios = Math.ceil(demandaAnual / capacidadeAnualPorOperador);
  const previsaoContratar = Math.max(0, headsNecessarios - inp.headcountAtual);
  const previsaoTreinarHoras = Math.round(previsaoContratar * 42 * 10) / 10;

  const arr = inp.demanda12Meses;
  const mean = arr.reduce((a, b) => a + b, 0) / Math.max(1, arr.length);
  const variancia =
    arr.length > 1 ? arr.reduce((s, x) => s + (x - mean) ** 2, 0) / arr.length : 0;
  const cv = demandaAnual > 0 ? Math.sqrt(variancia) / (demandaAnual / 12) : 0;
  const riscoTurnoverPct = Math.min(92, Math.round((12 + cv * 28) * 10) / 10);

  const ganhoMargem = previsaoContratar * inp.margemPorOperadorMesProxy * 12;
  const custo = Math.max(1, previsaoContratar * inp.custoContratacaoPorHeadProxy);
  const roiContratacaoProxy = Math.round((ganhoMargem / custo) * 100) / 100;

  return {
    previsaoContratar,
    previsaoTreinarHoras,
    riscoTurnoverPct,
    roiContratacaoProxy,
  };
}

/** Extrai série mensal [12] de custo “pessoal” a partir do OPEX total planejado (share configurável). */
export function extrairCustoMensalPessoalProxy(
  custoMensalTotal: MesValor[],
  sharePessoal: number,
): number[] {
  const sh = Math.min(0.92, Math.max(0.18, sharePessoal));
  return custoMensalTotal.map((m) => Math.round(m.valor * sh * 100) / 100);
}
