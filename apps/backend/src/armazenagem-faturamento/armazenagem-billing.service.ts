import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventoGatilhoTarifa, Prisma, StatusPreFatura, StatusPagamentoFatura } from '@prisma/client';
import { AlertService } from '../alert/alert.service';
import { BillingRuleEngineService } from '../billing-engine/billing-rule-engine.service';
import { assertTabelaPrecoConfigurada, inferTipoContainer } from '../billing-engine/billing-rule-engine.util';
import { normalizeContainerIso } from '../common/utils/data-sanitize';
import { OutboxService } from '../outbox/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_FREE_TIME_DIAS,
  DEFAULT_VALOR_DIARIA,
  toDecimal,
} from './armazenagem-billing.util';
import { assertNoConflictingBilling } from './billing-coexistence.util';

export type PreFaturaPortalView = {
  containerIso: string;
  isoFormatado: string;
  status: StatusPreFatura;
  valorAcumulado: number;
  diasCobrados: number;
  diasEstadia: number;
  freeTimeDias: number;
  valorDiaria: number;
  cobrancaInicioEm: string | null;
  gateInEm: string;
  provisionado: boolean;
  aviso: string;
  itens?: Array<{
    eventoGatilho: string;
    descricao: string;
    quantidade: number;
    valorTotal: number;
  }>;
};

@Injectable()
export class ArmazenagemBillingService {
  private readonly logger = new Logger(ArmazenagemBillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly ruleEngine: BillingRuleEngineService,
    private readonly alerts: AlertService,
  ) {}

  /** Abre pré-faturas ABERTAS para cada ISO provisionado no gate-in. */
  async openPreFaturasForGateIn(
    gateInId: string,
    clienteId: string,
    gateInAt: Date,
    tx: Prisma.TransactionClient,
  ) {
    const pricing = await this.ruleEngine.resolvePricingForCliente(clienteId);
    const clienteRow = await tx.cliente.findUnique({
      where: { id: clienteId },
      select: { tenantId: true },
    });
    const tenantId = clienteRow?.tenantId ?? 'default';
    const units = await tx.patioUnidade.findMany({
      where: { gateInId },
      select: { unidadeIso: true },
    });

    for (const u of units) {
      const containerIso = normalizeContainerIso(u.unidadeIso).replace(/\s/g, '').toUpperCase();
      await assertNoConflictingBilling(tx, { containerIso, clienteId, gateInId });
      const pf = await tx.preFatura.upsert({
        where: { gateInId_containerIso: { gateInId, containerIso } },
        create: {
          containerIso,
          clienteId,
          gateInId,
          gateInAt,
          valorAcumulado: toDecimal(0),
          diasCobrados: 0,
          status: StatusPreFatura.ABERTA,
        },
        update: {},
      });

      const container = await this.ruleEngine.loadContainerContext(gateInId, containerIso);
      const evaluation = await this.ruleEngine.evaluateForContainerCycleWithTenant(tenantId, {
        gateInAt,
        asOf: gateInAt,
        regras: pricing.regras,
        container,
        fase: 'GATE_IN',
        clienteId,
        tabelaPrecoId: pricing.tabelaPrecoId,
        gateInId,
        containerIso,
      });

      await this.ruleEngine.persistItens(
        pf.id,
        evaluation,
        tx,
        [EventoGatilhoTarifa.GATE_IN],
      );
      const total = await this.ruleEngine.sumItensTotal(pf.id, tx);
      await tx.preFatura.update({
        where: { id: pf.id },
        data: {
          valorAcumulado: toDecimal(total),
          diasCobrados: evaluation.diasFaturaveis,
          cobrancaInicioEm: this.ruleEngine.cobrancaInicioEm(gateInAt, evaluation.diasFreeTime),
        },
      });
    }
  }

  /** Motor de provisão diária — contêineres EM_PATIO (gate-in sem gate-out). */
  async runDailyProvision(asOf = new Date()) {
    const open = await this.prisma.preFatura.findMany({
      where: {
        status: StatusPreFatura.ABERTA,
        gateIn: { checkOut: null },
      },
      include: {
        gateIn: { select: { dataHora: true } },
        cliente: { select: { id: true, tenantId: true } },
      },
    });

    const skippedTenants = new Set<string>();
    let updated = 0;

    for (const pf of open) {
      const tenantId = pf.cliente.tenantId;

      if (!skippedTenants.has(tenantId)) {
        const padrao = await this.prisma.tabelaPreco.findFirst({
          where: { tenantId, OR: [{ padrao: true }, { ativa: true }] },
          include: { regras: { where: { ativa: true } } },
        });

        if (!padrao?.regras.length) {
          this.logger.warn(`Tenant ${tenantId} sem tabela de preço — pulando provisão`);
          await this.alerts.fiscalIpmDown({
            reason: `Tenant ${tenantId} sem tabela de preço configurada`,
          });
          skippedTenants.add(tenantId);
        }
      }

      if (skippedTenants.has(tenantId)) continue;

      const pricing = await this.ruleEngine.resolvePricingForCliente(pf.clienteId);
      const container = await this.ruleEngine.loadContainerContext(pf.gateInId, pf.containerIso);

      if (pricing.source === 'TABELA_PRECO') {
        const tabela = await this.prisma.tabelaPreco.findFirst({
          where: { id: pricing.tabelaPrecoId },
          include: { regras: { where: { ativa: true } } },
        });
        try {
          assertTabelaPrecoConfigurada(tabela, inferTipoContainer(container));
        } catch (err) {
          this.logger.error(`Erro provisionando ${pf.id}: ${(err as Error).message}`);
          continue;
        }
      }

      const diariaEval = await this.ruleEngine.evaluateForContainerCycleWithTenant(tenantId, {
        gateInAt: pf.gateIn.dataHora,
        asOf,
        regras: pricing.regras,
        container,
        fase: 'PROVISAO_DIARIA',
        clienteId: pf.clienteId,
        tabelaPrecoId: pricing.tabelaPrecoId,
        gateInId: pf.gateInId,
        containerIso: pf.containerIso,
      });

      await this.ruleEngine.persistItens(pf.id, diariaEval, undefined, [
        EventoGatilhoTarifa.DIARIA_ARMAZENAGEM,
        EventoGatilhoTarifa.SHIFTING_EXTRA,
        EventoGatilhoTarifa.ENERGIA_REEFER,
      ]);

      const total = await this.ruleEngine.sumItensTotal(pf.id);
      await this.prisma.preFatura.update({
        where: { id: pf.id },
        data: {
          diasCobrados: diariaEval.diasFaturaveis,
          valorAcumulado: toDecimal(total),
          cobrancaInicioEm: this.ruleEngine.cobrancaInicioEm(
            pf.gateIn.dataHora,
            diariaEval.diasFreeTime,
          ),
        },
      });
      updated++;
    }

    this.logger.log(`CRON rule engine: ${updated} pré-fatura(s) provisionadas`);
    return { updated, asOf: asOf.toISOString(), engine: 'BillingRuleEngine', skippedTenants: [...skippedTenants] };
  }

  /** Visão portal — tenant isolation + cálculo ao vivo se ABERTA. */
  async getPreFaturaForClient(isoRaw: string, clienteId: string): Promise<PreFaturaPortalView> {
    const containerIso = normalizeContainerIso(isoRaw).replace(/\s/g, '').toUpperCase();
    if (!containerIso) throw new NotFoundException('Contêiner não encontrado');

    const pricing = await this.ruleEngine.resolvePricingForCliente(clienteId);
    const clienteRow = await this.prisma.cliente.findUnique({
      where: { id: clienteId },
      select: { tenantId: true },
    });
    const tenantId = clienteRow?.tenantId ?? 'default';
    const diariaRegra = pricing.regras.find(
      (r) => r.eventoGatilho === EventoGatilhoTarifa.DIARIA_ARMAZENAGEM && r.ativa,
    );
    const freeTimeDias = diariaRegra?.diasFreeTime ?? DEFAULT_FREE_TIME_DIAS;
    const valorDiaria = Number(diariaRegra?.valor ?? DEFAULT_VALOR_DIARIA);

    let pf = await this.prisma.preFatura.findFirst({
      where: {
        containerIso,
        clienteId,
        status: StatusPreFatura.ABERTA,
        gateIn: { checkOut: null },
      },
      orderBy: { gateInAt: 'desc' },
      include: {
        gateIn: { select: { dataHora: true } },
        itens: true,
      },
    });

    let gateInAt: Date;
    const status = StatusPreFatura.ABERTA;

    if (pf) {
      gateInAt = pf.gateIn.dataHora;
    } else {
      const unit = await this.prisma.patioUnidade.findFirst({
        where: {
          unidadeIso: { equals: containerIso, mode: 'insensitive' },
          solicitacao: { clienteId, status: 'EM_PATIO' },
          gateIn: { checkOut: null },
        },
        include: { gateIn: { select: { dataHora: true } } },
        orderBy: { createdAt: 'desc' },
      });
      if (!unit) {
        const consolidated = await this.prisma.preFatura.findFirst({
          where: { containerIso, clienteId, status: StatusPreFatura.CONSOLIDADA },
          orderBy: { updatedAt: 'desc' },
          include: {
            gateIn: { select: { dataHora: true } },
            fatura: true,
            itens: true,
          },
        });
        if (consolidated) {
          return {
            ...this.toPortalView(
              consolidated.containerIso,
              StatusPreFatura.CONSOLIDADA,
              consolidated.gateIn.dataHora,
              freeTimeDias,
              valorDiaria,
              {
                valorAcumulado: Number(consolidated.valorAcumulado),
                diasCobrados: consolidated.diasCobrados,
                diasEstadia: consolidated.diasCobrados,
                cobrancaInicioEm: consolidated.cobrancaInicioEm,
              },
              false,
              consolidated.itens,
            ),
            aviso: 'Fatura consolidada no Gate-Out. Consulte Financeiro para NFS-e e boleto.',
            provisionado: false,
          };
        }
        throw new NotFoundException('Nenhuma provisão aberta para este contêiner');
      }
      gateInAt = unit.gateIn.dataHora;
    }

    const resolvedGateInId =
      pf?.gateInId ??
      (
        await this.prisma.patioUnidade.findFirstOrThrow({
          where: {
            unidadeIso: { equals: containerIso, mode: 'insensitive' },
            solicitacao: { clienteId },
            gateIn: { checkOut: null },
          },
        })
      ).gateInId;

    const container = await this.ruleEngine.loadContainerContext(resolvedGateInId, containerIso);

    const live = await this.ruleEngine.evaluateForContainerCycleWithTenant(tenantId, {
      gateInAt,
      asOf: new Date(),
      regras: pricing.regras,
      container,
      fase: 'PROVISAO_DIARIA',
      clienteId,
      tabelaPrecoId: pricing.tabelaPrecoId,
      gateInId: resolvedGateInId,
      containerIso,
    });

    const gateInItems =
      pf?.itens.filter((i) => i.eventoGatilho === EventoGatilhoTarifa.GATE_IN) ?? [];
    const valorAcumulado =
      live.valorTotal + gateInItems.reduce((acc, i) => acc + Number(i.valorTotal), 0);

    return this.toPortalView(
      containerIso,
      status,
      gateInAt,
      freeTimeDias,
      valorDiaria,
      {
        valorAcumulado,
        diasCobrados: live.diasFaturaveis,
        diasEstadia: live.diasNoPatio,
        cobrancaInicioEm: this.ruleEngine.cobrancaInicioEm(gateInAt, live.diasFreeTime),
      },
      true,
      [...gateInItems, ...live.items.map((i) => ({ ...i, valorTotal: i.valorTotal }))],
    );
  }

  private toPortalView(
    containerIso: string,
    status: StatusPreFatura,
    gateInAt: Date,
    freeTimeDias: number,
    valorDiaria: number,
    calc: {
      valorAcumulado: number;
      diasCobrados: number;
      diasEstadia: number;
      cobrancaInicioEm: Date | null;
    },
    provisionado: boolean,
    itens?: Array<{ eventoGatilho: string; descricao: string; quantidade: number; valorTotal: unknown }>,
  ): PreFaturaPortalView {
    return {
      containerIso,
      isoFormatado: containerIso,
      status,
      valorAcumulado: calc.valorAcumulado,
      diasCobrados: calc.diasCobrados,
      diasEstadia: calc.diasEstadia,
      freeTimeDias,
      valorDiaria,
      cobrancaInicioEm: calc.cobrancaInicioEm?.toISOString() ?? null,
      gateInEm: gateInAt.toISOString(),
      provisionado,
      aviso:
        'Valores provisionados via rule engine. Fechamento final no Gate-Out (NFS-e + boleto).',
      itens: itens?.map((i) => ({
        eventoGatilho: i.eventoGatilho,
        descricao: i.descricao,
        quantidade: i.quantidade,
        valorTotal: Number(i.valorTotal),
      })),
    };
  }

  /** Gate-Out: congela pré-faturas, emite fatura (PROCESSANDO) + outbox NFS-e/boleto. */
  async consolidateOnGateOut(gateInId: string, gateOutAt: Date, tx: Prisma.TransactionClient) {
    const existingFatura = await tx.fatura.findFirst({
      where: { preFatura: { gateInId } },
      include: { preFatura: { select: { containerIso: true } } },
    });
    if (existingFatura) {
      throw new ConflictException(
        `Fatura ${existingFatura.id} já consolidada para gate-in ${gateInId} (ISO ${existingFatura.preFatura.containerIso})`,
      );
    }

    const preFaturas = await tx.preFatura.findMany({
      where: { gateInId, status: StatusPreFatura.ABERTA },
      include: { gateIn: { select: { dataHora: true } } },
    });

    for (const pf of preFaturas) {
      const pricing = await this.ruleEngine.resolvePricingForCliente(pf.clienteId);
      const container = await this.ruleEngine.loadContainerContext(gateInId, pf.containerIso);
      const clientePf = await tx.cliente.findUnique({
        where: { id: pf.clienteId },
        select: { tenantId: true },
      });
      const tenantIdPf = clientePf?.tenantId ?? 'default';

      const evaluation = await this.ruleEngine.evaluateForContainerCycleWithTenant(tenantIdPf, {
        gateInAt: pf.gateIn.dataHora,
        asOf: gateOutAt,
        regras: pricing.regras,
        container,
        fase: 'GATE_OUT',
        clienteId: pf.clienteId,
        tabelaPrecoId: pricing.tabelaPrecoId,
        gateInId,
        containerIso: pf.containerIso,
      });

      await this.ruleEngine.persistItens(pf.id, evaluation, tx);

      const consolidated = await tx.preFatura.update({
        where: { id: pf.id },
        data: {
          status: StatusPreFatura.CONSOLIDADA,
          diasCobrados: evaluation.diasFaturaveis,
          valorAcumulado: toDecimal(evaluation.valorTotal),
          cobrancaInicioEm: this.ruleEngine.cobrancaInicioEm(
            pf.gateIn.dataHora,
            evaluation.diasFreeTime,
          ),
        },
      });

      const fatura = await tx.fatura.create({
        data: {
          preFaturaId: consolidated.id,
          clienteId: pf.clienteId,
          valorTotal: toDecimal(evaluation.valorTotal),
          dataEmissao: gateOutAt,
          statusPagamento: StatusPagamentoFatura.PROCESSANDO,
        },
      });

      await this.outbox.enqueue(tx, {
        aggregateType: 'FaturaArmazenagem',
        aggregateId: fatura.id,
        eventType: 'EMITIR_NFSE_BOLETO',
        payload: {
          faturaId: fatura.id,
          preFaturaId: consolidated.id,
          clienteId: pf.clienteId,
          containerIso: pf.containerIso,
          valorTotal: evaluation.valorTotal,
          gateInAt: pf.gateIn.dataHora.toISOString(),
          gateOutAt: gateOutAt.toISOString(),
          diasCobrados: evaluation.diasFaturaveis,
          itens: evaluation.items,
        },
      });

      this.logger.log(
        `Gate-Out rule engine: ${pf.containerIso} — R$ ${evaluation.valorTotal.toFixed(2)} (fatura ${fatura.id})`,
      );
    }
  }

  async assertClientOwnsContainer(isoRaw: string, clienteId: string): Promise<boolean> {
    const containerIso = normalizeContainerIso(isoRaw).replace(/\s/g, '').toUpperCase();
    const hit = await this.prisma.preFatura.findFirst({
      where: { containerIso, clienteId },
      select: { id: true },
    });
    if (hit) return true;
    const inYard = await this.prisma.patioUnidade.findFirst({
      where: {
        unidadeIso: { equals: containerIso, mode: 'insensitive' },
        solicitacao: { clienteId },
        gateIn: { checkOut: null },
      },
    });
    if (inYard) return true;
    throw new ForbiddenException('Contêiner não pertence ao tenant do cliente');
  }
}
