import { EventoGatilhoTarifa } from '@prisma/client';
import { evaluateBillingRules } from '../billing-engine/billing-rule-engine.util';
import type {
  BillingRuleEngineResult,
  ContainerBillingContext,
  ItemFaturaCalculado,
} from '../billing-engine/billing-rule-engine.types';
import { roundMoney } from '../armazenagem-faturamento/armazenagem-billing.util';

export type AluguelItemLike = {
  tipoContainerCodigo: string;
  containerTamanho: string;
  valorDiaria: number;
  diasFreeTime: number;
  valorEntrega: number;
  valorColeta: number;
  ativo: boolean;
};

export function normalizeTamanhoAluguel(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return digits ? `${digits}'` : raw.trim();
}

export function matchAluguelItem(
  itens: AluguelItemLike[],
  tipoCodigo: string,
  tamanho: string,
): AluguelItemLike | null {
  const tipo = tipoCodigo.trim().toUpperCase();
  const tam = normalizeTamanhoAluguel(tamanho);
  let best: { item: AluguelItemLike; score: number } | null = null;
  for (const item of itens) {
    if (!item.ativo) continue;
    const itemTipo = item.tipoContainerCodigo.trim().toUpperCase();
    const itemTam = normalizeTamanhoAluguel(item.containerTamanho);
    let score = 0;
    if (itemTipo && itemTipo !== '*') {
      if (itemTipo !== tipo) continue;
      score += 2;
    }
    if (itemTam && itemTam !== '*') {
      if (itemTam !== tam) continue;
      score += 2;
    }
    if (!best || score > best.score) best = { item, score };
  }
  return best?.item ?? null;
}

export function containerContextFromAluguel(input: {
  tipoContainerCodigo: string;
  containerTamanho: string;
}): ContainerBillingContext {
  const tipo = input.tipoContainerCodigo.toUpperCase();
  return {
    tipo,
    tamanho: normalizeTamanhoAluguel(input.containerTamanho).replace("'", ''),
    refrigerado: tipo.includes('REEFER'),
  };
}

export function evaluateAluguelCycle(input: {
  iniciadoEm: Date;
  asOf: Date;
  item: AluguelItemLike;
  container: ContainerBillingContext;
  fase: 'INICIO' | 'DIARIA' | 'DEVOLUCAO';
}): BillingRuleEngineResult {
  const minimoUmDia = input.fase === 'DEVOLUCAO' && input.item.diasFreeTime <= 0;
  let asOf = input.asOf;
  if (minimoUmDia && asOf.getTime() <= input.iniciadoEm.getTime()) {
    asOf = new Date(input.iniciadoEm.getTime() + 24 * 60 * 60 * 1000);
  }

  const result = evaluateBillingRules({
    gateInAt: input.iniciadoEm,
    asOf,
    regras: [],
    container: input.container,
    incluirGateIn: false,
    incluirGateOut: false,
    pricingOverrides: {
      diasFreeTime: input.item.diasFreeTime,
      valorDiaria: Number(input.item.valorDiaria),
    },
  });

  if (minimoUmDia && result.diasFaturaveis === 0 && Number(input.item.valorDiaria) > 0) {
    const valorUnitario = roundMoney(Number(input.item.valorDiaria));
    result.items.push({
      regraTarifariaId: null,
      eventoGatilho: EventoGatilhoTarifa.DIARIA_ARMAZENAGEM,
      descricao: 'Diária de aluguel',
      quantidade: 1,
      valorUnitario,
      valorTotal: valorUnitario,
    });
    result.diasFaturaveis = 1;
    result.diasNoPatio = Math.max(result.diasNoPatio, 1);
    result.valorTotal = roundMoney(result.valorTotal + valorUnitario);
  }

  const extras: ItemFaturaCalculado[] = [];
  if (input.fase === 'INICIO' && Number(input.item.valorEntrega) > 0) {
    const valor = roundMoney(Number(input.item.valorEntrega));
    extras.push({
      regraTarifariaId: null,
      eventoGatilho: EventoGatilhoTarifa.GATE_IN,
      descricao: 'Entrega do container (aluguel)',
      quantidade: 1,
      valorUnitario: valor,
      valorTotal: valor,
    });
  }
  if (input.fase === 'DEVOLUCAO' && Number(input.item.valorColeta) > 0) {
    const valor = roundMoney(Number(input.item.valorColeta));
    extras.push({
      regraTarifariaId: null,
      eventoGatilho: EventoGatilhoTarifa.GATE_OUT,
      descricao: 'Coleta do container (aluguel)',
      quantidade: 1,
      valorUnitario: valor,
      valorTotal: valor,
    });
  }

  if (extras.length) {
    result.items.push(...extras);
    result.valorTotal = roundMoney(
      result.valorTotal + extras.reduce((acc, i) => acc + i.valorTotal, 0),
    );
  }

  for (const item of result.items) {
    if (item.eventoGatilho === EventoGatilhoTarifa.DIARIA_ARMAZENAGEM) {
      item.descricao = item.descricao.replace(/Diária de armazenagem/i, 'Diária de aluguel');
      if (!item.descricao.toLowerCase().includes('aluguel') && !item.descricao.toLowerCase().includes('escalonada')) {
        item.descricao = 'Diária de aluguel';
      }
    }
  }

  return result;
}
