import {
  EventoGatilhoTarifa,
  TipoContainerTarifa,
} from '@prisma/client';
import { diffCalendarDays, roundMoney } from '../armazenagem-faturamento/armazenagem-billing.util';
import type {
  BillingRuleEngineInput,
  BillingRuleEngineResult,
  ContainerBillingContext,
  ItemFaturaCalculado,
  LegacyTarifaLike,
  RegraTarifariaLike,
} from './billing-rule-engine.types';

const IMO_HINTS = ['IMO', 'PERIG', 'HAZ', 'DGR', 'ONU'];
const REEFER_HINTS = ['REEFER', 'RF', 'REEF'];

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
): boolean {
  if (!regra.ativa) return false;
  if (regra.tipoContainer === TipoContainerTarifa.TODOS) return true;
  return regra.tipoContainer === tipo;
}

export function pickRegra(
  regras: RegraTarifariaLike[],
  tipo: TipoContainerTarifa,
  evento: EventoGatilhoTarifa,
): RegraTarifariaLike | undefined {
  const matched = regras.filter(
    (r) => r.eventoGatilho === evento && regraMatchesContainer(r, tipo),
  );
  if (!matched.length) return undefined;
  const specific = matched.find((r) => r.tipoContainer !== TipoContainerTarifa.TODOS);
  return specific ?? matched[0];
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
  const diasNoPatio = diffCalendarDays(input.gateInAt, input.asOf);
  const items: ItemFaturaCalculado[] = [];

  if (input.incluirGateIn) {
    const regra = pickRegra(input.regras, tipoContainer, EventoGatilhoTarifa.GATE_IN);
    if (regra && Number(regra.valor) > 0) {
      items.push(buildFixedItem(regra, EventoGatilhoTarifa.GATE_IN, 'Taxa Gate-In'));
    }
  }

  if (input.incluirGateOut) {
    const regra = pickRegra(input.regras, tipoContainer, EventoGatilhoTarifa.GATE_OUT);
    if (regra && Number(regra.valor) > 0) {
      items.push(buildFixedItem(regra, EventoGatilhoTarifa.GATE_OUT, 'Taxa Gate-Out'));
    }
  }

  const regraDiaria = pickRegra(
    input.regras,
    tipoContainer,
    EventoGatilhoTarifa.DIARIA_ARMAZENAGEM,
  );
  const diasFreeTime = regraDiaria?.diasFreeTime ?? 0;
  const diasFaturaveis = Math.max(0, diasNoPatio - diasFreeTime);

  if (regraDiaria && diasFaturaveis > 0) {
    const valorUnitario = roundMoney(Number(regraDiaria.valor));
    items.push({
      regraTarifariaId: regraDiaria.id,
      eventoGatilho: EventoGatilhoTarifa.DIARIA_ARMAZENAGEM,
      descricao: regraDiaria.nome?.trim() || 'Diária de armazenagem',
      quantidade: diasFaturaveis,
      valorUnitario,
      valorTotal: roundMoney(diasFaturaveis * valorUnitario),
    });
  }

  const shiftingQty = Math.max(0, input.shiftingExtras ?? 0);
  if (shiftingQty > 0) {
    const regraShift = pickRegra(
      input.regras,
      tipoContainer,
      EventoGatilhoTarifa.SHIFTING_EXTRA,
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
