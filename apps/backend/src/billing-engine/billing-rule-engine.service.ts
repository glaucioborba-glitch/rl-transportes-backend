import { Injectable } from '@nestjs/common';
import {
  EventoGatilhoTarifa,
  Prisma,
  type RegraTarifaria,
  type TabelaPreco,
} from '@prisma/client';
import { addCalendarDays } from '../armazenagem-faturamento/armazenagem-billing.util';
import { PrismaService } from '../prisma/prisma.service';
import type {
  BillingRuleEngineInput,
  BillingRuleEngineResult,
  ContainerBillingContext,
  LegacyTarifaLike,
} from './billing-rule-engine.types';
import {
  applyLegacyShiftingOnFirstBillableDay,
  evaluateBillingRules,
  legacyTarifaToRegras,
} from './billing-rule-engine.util';

export type ResolvedPricingTable = {
  source: 'TABELA_PRECO' | 'LEGADO' | 'DEFAULT';
  tabelaPrecoId?: string;
  regras: RegraTarifaria[];
  legado?: LegacyTarifaLike;
};

@Injectable()
export class BillingRuleEngineService {
  constructor(private readonly prisma: PrismaService) {}

  async resolvePricingForCliente(clienteId: string): Promise<ResolvedPricingTable> {
    const cliente = await this.prisma.cliente.findFirst({
      where: { id: clienteId, deletedAt: null },
      include: {
        tabelaPreco: {
          include: { regras: { where: { ativa: true }, orderBy: { createdAt: 'asc' } } },
        },
        tabelaTarifaria: true,
      },
    });
    if (!cliente) {
      return { source: 'DEFAULT', regras: this.defaultRegras() };
    }

    if (cliente.tabelaPreco?.ativa && cliente.tabelaPreco.regras.length) {
      return {
        source: 'TABELA_PRECO',
        tabelaPrecoId: cliente.tabelaPreco.id,
        regras: cliente.tabelaPreco.regras,
      };
    }

    if (cliente.tabelaTarifaria) {
      const legado: LegacyTarifaLike = {
        freeTimeDias: cliente.tabelaTarifaria.freeTimeDias,
        valorDiaria: Number(cliente.tabelaTarifaria.valorDiaria),
        valorServicosExtras: Number(cliente.tabelaTarifaria.valorServicosExtras),
      };
      return {
        source: 'LEGADO',
        regras: legacyTarifaToRegras(legado) as RegraTarifaria[],
        legado,
      };
    }

    return { source: 'DEFAULT', regras: this.defaultRegras() };
  }

  evaluate(input: BillingRuleEngineInput, legado?: LegacyTarifaLike): BillingRuleEngineResult {
    let result = evaluateBillingRules(input);
    if (legado) {
      result = applyLegacyShiftingOnFirstBillableDay(result, legado);
    }
    return result;
  }

  evaluateForContainerCycle(params: {
    gateInAt: Date;
    asOf: Date;
    regras: RegraTarifaria[];
    container: ContainerBillingContext;
    fase: 'GATE_IN' | 'PROVISAO_DIARIA' | 'GATE_OUT';
    legado?: LegacyTarifaLike;
    shiftingExtras?: number;
  }): BillingRuleEngineResult {
    const incluirGateIn = params.fase === 'GATE_IN' || params.fase === 'GATE_OUT';
    const incluirGateOut = params.fase === 'GATE_OUT';
    const shiftingExtras =
      params.fase === 'GATE_OUT' ? params.shiftingExtras : params.fase === 'PROVISAO_DIARIA' ? 0 : 0;

    return this.evaluate(
      {
        gateInAt: params.gateInAt,
        asOf: params.asOf,
        regras: params.regras,
        container: params.container,
        incluirGateIn,
        incluirGateOut,
        shiftingExtras,
      },
      params.legado,
    );
  }

  cobrancaInicioEm(gateInAt: Date, diasFreeTime: number): Date | null {
    if (diasFreeTime <= 0) return gateInAt;
    return addCalendarDays(gateInAt, diasFreeTime);
  }

  async loadContainerContext(
    gateInId: string,
    containerIso: string,
  ): Promise<ContainerBillingContext> {
    const unit = await this.prisma.patioUnidade.findFirst({
      where: { gateInId, unidadeIso: containerIso },
      include: {
        solicitacao: {
          include: { containersSolicitacao: true },
        },
      },
    });
    if (!unit) {
      return { tamanho: '40', tipo: 'DRY', refrigerado: false };
    }

    const isoNorm = containerIso.replace(/\s/g, '').toUpperCase();
    const fromForm = unit.solicitacao.containersSolicitacao.find(
      (c) => c.unidade.replace(/\s/g, '').toUpperCase() === isoNorm,
    );

    return {
      tamanho: fromForm?.tamanho ?? '40',
      tipo: fromForm?.tipo ?? 'DRY',
      refrigerado: fromForm?.refrigerado ?? unit.refrigerado,
    };
  }

  async persistItens(
    preFaturaId: string,
    evaluation: BillingRuleEngineResult,
    tx?: Prisma.TransactionClient,
    replaceEventos?: EventoGatilhoTarifa[],
  ) {
    const db = tx ?? this.prisma;
    const eventos =
      replaceEventos ??
      ([
        EventoGatilhoTarifa.GATE_IN,
        EventoGatilhoTarifa.GATE_OUT,
        EventoGatilhoTarifa.DIARIA_ARMAZENAGEM,
        EventoGatilhoTarifa.SHIFTING_EXTRA,
      ] as EventoGatilhoTarifa[]);

    await db.itemFaturaArmazenagem.deleteMany({
      where: { preFaturaId, eventoGatilho: { in: eventos } },
    });

    const toInsert = evaluation.items.filter((i) => eventos.includes(i.eventoGatilho));
    if (!toInsert.length) return;

    await db.itemFaturaArmazenagem.createMany({
      data: toInsert.map((item) => ({
        preFaturaId,
        regraTarifariaId:
          item.regraTarifariaId && !item.regraTarifariaId.startsWith('legacy')
            ? item.regraTarifariaId
            : null,
        eventoGatilho: item.eventoGatilho,
        descricao: item.descricao,
        quantidade: item.quantidade,
        valorUnitario: new Prisma.Decimal(item.valorUnitario.toFixed(2)),
        valorTotal: new Prisma.Decimal(item.valorTotal.toFixed(2)),
      })),
    });
  }

  async sumItensTotal(preFaturaId: string, tx?: Prisma.TransactionClient): Promise<number> {
    const db = tx ?? this.prisma;
    const agg = await db.itemFaturaArmazenagem.aggregate({
      where: { preFaturaId },
      _sum: { valorTotal: true },
    });
    return Number(agg._sum.valorTotal ?? 0);
  }

  private defaultRegras(): RegraTarifaria[] {
    const now = new Date();
    const mk = (
      eventoGatilho: EventoGatilhoTarifa,
      valor: number,
      diasFreeTime: number,
    ): RegraTarifaria =>
      ({
        id: `default-${eventoGatilho}`,
        tabelaPrecoId: 'default',
        nome: eventoGatilho,
        eventoGatilho,
        tipoContainer: 'TODOS',
        valor: new Prisma.Decimal(valor.toFixed(2)),
        diasFreeTime,
        ativa: true,
        createdAt: now,
        updatedAt: now,
      }) as RegraTarifaria;

    return [
      mk(EventoGatilhoTarifa.DIARIA_ARMAZENAGEM, 85, 5),
      mk(EventoGatilhoTarifa.GATE_IN, 0, 0),
      mk(EventoGatilhoTarifa.GATE_OUT, 0, 0),
    ];
  }
}

export type { TabelaPreco };
