import {
  EventoGatilhoTarifa,
  StatusContainerTarifa,
  TipoContainerTarifa,
} from '@prisma/client';
import { diffCalendarDays, diffDiasCalendario, roundMoney } from '../armazenagem-faturamento/armazenagem-billing.util';
import {
  calcularArmazenagemEscalonada,
  valorMedioDiariaEscalonada,
} from './faixa-diaria-calculator';
import { parseFaixasDiaria } from './faixa-diaria.types';
import type {
  BillingRuleEngineInput,
  BillingRuleEngineResult,
  ContainerBillingContext,
  ContainerMdmKeys,
  ItemFaturaCalculado,
  LegacyTarifaLike,
  RegraTarifariaLike,
} from './billing-rule-engine.types';

const IMO_HINTS = ['IMO', 'PERIG', 'HAZ', 'DGR', 'ONU'];
const REEFER_HINTS = ['REEFER', 'RF', 'REEF'];
export const DEFAULT_TARIFA_ENERGIA_REEFER_DIA = 45;

export { diffDiasCalendario, diffCalendarDays };

/** Dias úteis — reservado para SLA/agendamento; faturamento usa dias corridos (PR-02). */
export function diffDiasUteis(
  inicio: Date,
  fim: Date,
  operacaoFimSemana: boolean,
  feriados: { data: string }[],
): number {
  let dias = 0;
  const atual = new Date(inicio);
  const fimLimite = new Date(fim);

  while (atual < fimLimite) {
    const diaSemana = atual.getUTCDay();
    const dataStr = atual.toISOString().slice(0, 10);
    const isFimDeSemana = diaSemana === 0 || diaSemana === 6;
    const isFeriado = feriados.some((f) => f.data === dataStr);

    if (operacaoFimSemana) {
      if (!isFeriado) dias++;
    } else if (!isFimDeSemana && !isFeriado) {
      dias++;
    }

    atual.setUTCDate(atual.getUTCDate() + 1);
  }

  return dias;
}

function resolveDiasPermanencia(input: BillingRuleEngineInput): number {
  return diffDiasCalendario(input.gateInAt, input.asOf);
}

export type TabelaPrecoBillingLike = {
  id?: string;
  ativa?: boolean;
  regras?: RegraTarifariaLike[];
} | null;

/** Reefer com set point mais baixo consome mais energia. */
export function calculateReeferSurcharge(
  diasPermanencia: number,
  setPoint: number,
  tarifaEnergiaDiaria: number,
): number {
  const fatorConsumo = setPoint < -10 ? 1.5 : setPoint < 0 ? 1.2 : 1.0;
  return roundMoney(diasPermanencia * tarifaEnergiaDiaria * fatorConsumo);
}

export function reeferEnergyFactor(setPoint: number): number {
  return setPoint < -10 ? 1.5 : setPoint < 0 ? 1.2 : 1.0;
}

export function assertTabelaPrecoConfigurada(
  tabela: TabelaPrecoBillingLike,
  tipoContainer: TipoContainerTarifa,
): void {
  if (!tabela?.ativa || !tabela.regras?.length) {
    throw new Error(
      'Tabela de preço não configurada para tenant. Configure em /v2/cadastros/tabelas-preco antes de faturar.',
    );
  }

  const diaria = pickRegra(tabela.regras, tipoContainer, EventoGatilhoTarifa.DIARIA_ARMAZENAGEM, null);
  if (!diaria) {
    throw new Error(
      `Item de preço (diária) não encontrado para tipo de contêiner ${tipoContainer}.`,
    );
  }
}

export function inferTipoContainer(ctx: ContainerBillingContext): TipoContainerTarifa {
  const tipo = (ctx.tipo ?? '').toUpperCase();
  if (IMO_HINTS.some((h) => tipo.includes(h))) {
    return TipoContainerTarifa.IMO_PERIGOSA;
  }
  if (ctx.refrigerado || REEFER_HINTS.some((h) => tipo.includes(h))) {
    return TipoContainerTarifa.REEFER;
  }
  const digits = (ctx.tamanho ?? '').replace(/\D/g, '');
  if (digits.startsWith('20')) return TipoContainerTarifa.DRY_20;
  if (digits.startsWith('40') || digits.startsWith('45')) return TipoContainerTarifa.DRY_40;
  return TipoContainerTarifa.TODOS;
}

export function regraMatchesContainer(
  regra: RegraTarifariaLike,
  tipo: TipoContainerTarifa,
  status?: StatusContainerTarifa | null,
): boolean {
  if (!regra.ativa) return false;
  if (regra.tipoContainer !== TipoContainerTarifa.TODOS && regra.tipoContainer !== tipo) {
    return false;
  }
  const regraStatus = regra.statusContainer ?? StatusContainerTarifa.AMBOS;
  if (regraStatus === StatusContainerTarifa.AMBOS) return true;
  if (!status) return false;
  return regraStatus === status;
}

export function scoreRegraTarifaria(
  regra: RegraTarifariaLike,
  tipo: TipoContainerTarifa,
  status?: StatusContainerTarifa | null,
): number {
  if (!regraMatchesContainer(regra, tipo, status)) return -1;
  let score = 0;
  if (regra.tipoContainer !== TipoContainerTarifa.TODOS) score += 2;
  const rs = regra.statusContainer ?? StatusContainerTarifa.AMBOS;
  if (rs !== StatusContainerTarifa.AMBOS && status && rs === status) score += 4;
  return score;
}

export function extractContainerMdmKeys(ctx: ContainerBillingContext): ContainerMdmKeys {
  const tipoRaw = (ctx.tipo ?? 'DRY').toUpperCase();
  let tipoCodigo = tipoRaw;
  let capacidadeCodigo = ctx.capacidade?.toUpperCase() ?? null;

  if (!capacidadeCodigo && (tipoRaw === 'HC' || tipoRaw === 'DC')) {
    capacidadeCodigo = tipoRaw;
    tipoCodigo = 'DRY';
  }

  const digits = (ctx.tamanho ?? '40').replace(/\D/g, '');
  const containerTamanho = digits ? `${digits}'` : "40'";

  if (ctx.refrigerado || REEFER_HINTS.some((h) => tipoRaw.includes(h))) {
    tipoCodigo = 'REEFER';
  }

  return { tipoCodigo, capacidadeCodigo, containerTamanho };
}

export function scoreRegraMdm(
  regra: RegraTarifariaLike,
  tipo: TipoContainerTarifa,
  status: StatusContainerTarifa | null | undefined,
  mdm: ContainerMdmKeys,
): number {
  if (!regraMatchesContainer(regra, tipo, status)) return -1;

  let score = scoreRegraTarifaria(regra, tipo, status);
  if (score < 0) return -1;

  const tipoKey = mdm.tipoCodigo?.toUpperCase();
  const capKey = mdm.capacidadeCodigo?.toUpperCase();
  const tamKey = mdm.containerTamanho;

  if (regra.tipoContainerCodigo) {
    if (regra.tipoContainerCodigo.toUpperCase() !== tipoKey) return -1;
    score += 8;
  }
  if (regra.capacidadeCodigo) {
    if (regra.capacidadeCodigo.toUpperCase() !== capKey) return -1;
    score += 6;
  } else if (capKey) {
    score += 1;
  }
  if (regra.containerTamanho) {
    if (regra.containerTamanho !== tamKey && regra.containerTamanho !== '*') return -1;
    if (regra.containerTamanho === tamKey) score += 4;
  }

  return score;
}

export function pickRegraMdm(
  regras: RegraTarifariaLike[],
  tipo: TipoContainerTarifa,
  evento: EventoGatilhoTarifa,
  status: StatusContainerTarifa | null | undefined,
  mdm: ContainerMdmKeys,
): RegraTarifariaLike | undefined {
  const matched = regras
    .filter((r) => r.eventoGatilho === evento)
    .map((r) => ({ r, score: scoreRegraMdm(r, tipo, status, mdm) }))
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score);
  return matched[0]?.r;
}

export function pickRegra(
  regras: RegraTarifariaLike[],
  tipo: TipoContainerTarifa,
  evento: EventoGatilhoTarifa,
  status?: StatusContainerTarifa | null,
  mdm?: ContainerMdmKeys,
): RegraTarifariaLike | undefined {
  if (mdm && regras.some((r) => r.tipoContainerCodigo || r.capacidadeCodigo || r.containerTamanho)) {
    const mdmPick = pickRegraMdm(regras, tipo, evento, status, mdm);
    if (mdmPick) return mdmPick;
  }
  const matched = regras
    .filter((r) => r.eventoGatilho === evento)
    .map((r) => ({ r, score: scoreRegraTarifaria(r, tipo, status) }))
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score);
  return matched[0]?.r;
}

function buildFixedItem(
  regra: RegraTarifariaLike,
  evento: EventoGatilhoTarifa,
  label: string,
): ItemFaturaCalculado {
  const valorUnitario = roundMoney(Number(regra.valor));
  return {
    regraTarifariaId: regra.id,
    eventoGatilho: evento,
    descricao: regra.nome?.trim() || label,
    quantidade: 1,
    valorUnitario,
    valorTotal: valorUnitario,
  };
}

export function evaluateBillingRules(input: BillingRuleEngineInput): BillingRuleEngineResult {
  const tipoContainer = inferTipoContainer(input.container);
  const statusContainer = input.container.statusContainer ?? null;
  const mdm = extractContainerMdmKeys(input.container);
  const diasNoPatio = resolveDiasPermanencia(input);
  const items: ItemFaturaCalculado[] = [];

  const regraHandling = pickRegra(
    input.regras,
    tipoContainer,
    EventoGatilhoTarifa.HANDLING,
    statusContainer,
    mdm,
  );
  const useHandling = Boolean(regraHandling && Number(regraHandling.valor) > 0);

  if (input.incluirGateOut && useHandling && regraHandling) {
    items.push(buildFixedItem(regraHandling, EventoGatilhoTarifa.HANDLING, 'Handling (entrada + saída)'));
  } else {
    if (input.incluirGateIn) {
      const regra = pickRegra(input.regras, tipoContainer, EventoGatilhoTarifa.GATE_IN, statusContainer, mdm);
      if (regra && Number(regra.valor) > 0) {
        items.push(buildFixedItem(regra, EventoGatilhoTarifa.GATE_IN, 'Taxa Gate-In'));
      }
    }
    if (input.incluirGateOut) {
      const regra = pickRegra(input.regras, tipoContainer, EventoGatilhoTarifa.GATE_OUT, statusContainer, mdm);
      if (regra && Number(regra.valor) > 0) {
        items.push(buildFixedItem(regra, EventoGatilhoTarifa.GATE_OUT, 'Taxa Gate-Out'));
      }
    }
  }

  const regraDiaria = pickRegra(
    input.regras,
    tipoContainer,
    EventoGatilhoTarifa.DIARIA_ARMAZENAGEM,
    statusContainer,
    mdm,
  );
  const diasFreeTime =
    input.pricingOverrides?.diasFreeTime ?? regraDiaria?.diasFreeTime ?? 0;

  const faixasFromOverride = input.pricingOverrides?.faixasDiaria;
  const faixasFromRegra = regraDiaria ? parseFaixasDiaria(regraDiaria.faixasDiaria) : [];
  const faixas = faixasFromOverride?.length ? faixasFromOverride : faixasFromRegra;

  let diasFaturaveis = Math.max(0, diasNoPatio - diasFreeTime);
  let diariaTotal = 0;

  if (regraDiaria && diasFaturaveis > 0) {
    if (faixas.length) {
      diariaTotal = calcularArmazenagemEscalonada(diasNoPatio, diasFreeTime, faixas);
      const { valorMedio } = valorMedioDiariaEscalonada(diasNoPatio, diasFreeTime, faixas);
      items.push({
        regraTarifariaId: regraDiaria.id,
        eventoGatilho: EventoGatilhoTarifa.DIARIA_ARMAZENAGEM,
        descricao: regraDiaria.nome?.trim() || 'Diária de armazenagem (escalonada)',
        quantidade: diasFaturaveis,
        valorUnitario: valorMedio,
        valorTotal: diariaTotal,
      });
    } else {
      const valorUnitario = roundMoney(
        input.pricingOverrides?.valorDiaria ?? Number(regraDiaria.valor),
      );
      diariaTotal = roundMoney(diasFaturaveis * valorUnitario);
      items.push({
        regraTarifariaId: regraDiaria.id,
        eventoGatilho: EventoGatilhoTarifa.DIARIA_ARMAZENAGEM,
        descricao: regraDiaria.nome?.trim() || 'Diária de armazenagem',
        quantidade: diasFaturaveis,
        valorUnitario,
        valorTotal: diariaTotal,
      });
    }
  }

  if (tipoContainer === TipoContainerTarifa.REEFER && diasNoPatio > 0) {
    const regraEnergia = pickRegra(
      input.regras,
      tipoContainer,
      EventoGatilhoTarifa.ENERGIA_REEFER,
      statusContainer,
      mdm,
    );
    const tarifaBase = input.pricingOverrides?.valorEnergiaReefer
      ?? (regraEnergia ? Number(regraEnergia.valor) : DEFAULT_TARIFA_ENERGIA_REEFER_DIA);
    const setPoint = input.container.setPoint ?? 0;
    const fator = reeferEnergyFactor(setPoint);
    const valorUnitario = roundMoney(tarifaBase * fator);
    const valorTotal = calculateReeferSurcharge(diasNoPatio, setPoint, tarifaBase);
    items.push({
      regraTarifariaId: regraEnergia?.id ?? null,
      eventoGatilho: EventoGatilhoTarifa.ENERGIA_REEFER,
      descricao:
        regraEnergia?.nome?.trim() ||
        `Energia reefer (set point ${setPoint}°C, fator ${fator}x)`,
      quantidade: diasNoPatio,
      valorUnitario,
      valorTotal,
    });
  }

  const shiftingQty = Math.max(0, input.shiftingExtras ?? 0);
  if (shiftingQty > 0) {
    const regraShift = pickRegra(
      input.regras,
      tipoContainer,
      EventoGatilhoTarifa.SHIFTING_EXTRA,
      statusContainer,
      mdm,
    );
    if (regraShift && Number(regraShift.valor) > 0) {
      const valorUnitario = roundMoney(Number(regraShift.valor));
      items.push({
        regraTarifariaId: regraShift.id,
        eventoGatilho: EventoGatilhoTarifa.SHIFTING_EXTRA,
        descricao: regraShift.nome?.trim() || 'Shifting extra',
        quantidade: shiftingQty,
        valorUnitario,
        valorTotal: roundMoney(shiftingQty * valorUnitario),
      });
    }
  }

  const valorTotal = roundMoney(items.reduce((acc, i) => acc + i.valorTotal, 0));
  return {
    items,
    valorTotal,
    diasNoPatio,
    diasFaturaveis,
    diasFreeTime,
    tipoContainer,
  };
}

/** Converte tarifa legada (`TabelaTarifaria`) em regras sintéticas. */
export function legacyTarifaToRegras(legado: LegacyTarifaLike): RegraTarifariaLike[] {
  const valorDiaria = Number(legado.valorDiaria);
  const extras = Number(legado.valorServicosExtras ?? 0);
  const regras: RegraTarifariaLike[] = [
    {
      id: 'legacy-diaria',
      eventoGatilho: EventoGatilhoTarifa.DIARIA_ARMAZENAGEM,
      tipoContainer: TipoContainerTarifa.TODOS,
      statusContainer: StatusContainerTarifa.AMBOS,
      valor: valorDiaria as unknown as RegraTarifariaLike['valor'],
      diasFreeTime: legado.freeTimeDias,
      ativa: true,
      nome: 'Diária legada',
    },
  ];
  if (extras > 0) {
    regras.push({
      id: 'legacy-shifting',
      eventoGatilho: EventoGatilhoTarifa.SHIFTING_EXTRA,
      tipoContainer: TipoContainerTarifa.TODOS,
      statusContainer: StatusContainerTarifa.AMBOS,
      valor: extras as unknown as RegraTarifariaLike['valor'],
      diasFreeTime: 0,
      ativa: true,
      nome: 'Serviços extras (1x após free time)',
    });
  }
  return regras;
}

/** Compat: primeira diária cobrada dispara shifting legado como taxa única. */
export function applyLegacyShiftingOnFirstBillableDay(
  result: BillingRuleEngineResult,
  legado: LegacyTarifaLike,
): BillingRuleEngineResult {
  const extras = Number(legado.valorServicosExtras ?? 0);
  if (extras <= 0 || result.diasFaturaveis <= 0) return result;
  const already = result.items.some((i) => i.eventoGatilho === EventoGatilhoTarifa.SHIFTING_EXTRA);
  if (already) return result;
  const shiftItem: ItemFaturaCalculado = {
    regraTarifariaId: 'legacy-shifting',
    eventoGatilho: EventoGatilhoTarifa.SHIFTING_EXTRA,
    descricao: 'Serviços extras',
    quantidade: 1,
    valorUnitario: roundMoney(extras),
    valorTotal: roundMoney(extras),
  };
  const items = [...result.items, shiftItem];
  return {
    ...result,
    items,
    valorTotal: roundMoney(items.reduce((acc, i) => acc + i.valorTotal, 0)),
  };
}
