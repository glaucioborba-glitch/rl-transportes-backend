import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EventoGatilhoTarifa, Prisma, StatusPreFatura, StatusPagamentoFatura } from '@prisma/client';
import { AlertService } from '../alert/alert.service';
import { BillingRuleEngineService } from '../billing-engine/billing-rule-engine.service';
import { assertTabelaPrecoConfigurada, inferTipoContainer } from '../billing-engine/billing-rule-engine.util';
import { normalizeContainerIso } from '../common/utils/data-sanitize';
import { PrismaService } from '../prisma/prisma.service';
import {
  containerContextFromAluguel,
  evaluateAluguelCycle,
  matchAluguelItem,
  type AluguelItemLike,
} from '../aluguel/aluguel-pricing.util';
import { toDecimal } from './armazenagem-billing.util';
import { assertNoConflictingBilling } from './billing-coexistence.util';
import { flagsExclusaoAutomatica, processoTemHandlingExcluido, syncExtrasOnPreFatura } from './fatura-extras.util';

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
    private readonly ruleEngine: BillingRuleEngineService,
    private readonly alerts: AlertService,
  ) {}

  /** Tabela incompleta não pode travar o ID da RIC. */
  private async resolvePricingForGateInOrSkip(clienteId: string) {
    try {
      return await this.ruleEngine.resolvePricingForCliente(clienteId);
    } catch (err) {
      if (err instanceof UnprocessableEntityException || err instanceof NotFoundException) {
        this.logger.warn(`Pré-fatura não abriu (tabela incompleta): ${err.message}`);
        return null;
      }
      throw err;
    }
  }

  private async evaluateGateInOrSkip(
    tenantId: string,
    params: Parameters<BillingRuleEngineService['evaluateForContainerCycleWithTenant']>[1],
  ) {
    try {
      return await this.ruleEngine.evaluateForContainerCycleWithTenant(tenantId, params);
    } catch (err) {
      if (err instanceof UnprocessableEntityException) {
        this.logger.warn(
          `Pré-fatura não abriu para ${'containerIso' in params ? params.containerIso : 'ISO'}: ${err.message}`,
        );
        return null;
      }
      throw err;
    }
  }

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
        [EventoGatilhoTarifa.GATE_IN, EventoGatilhoTarifa.HANDLING],
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

  /** Abre pré-faturas no ID da unidade (RIC/liberar de entrada). */
  async openPreFaturasForProcesso(
    input: {
      unidadeProcessoId: string;
      clienteId: string;
      entradaEm: Date;
      gateInId?: string | null;
      containerHint?: {
        tipo?: string | null;
        tamanho?: string | null;
        status?: string | null;
        refrigerado?: boolean;
        setPoint?: number | null;
      };
    },
    tx: Prisma.TransactionClient,
  ) {
    const pricing = await this.resolvePricingForGateInOrSkip(input.clienteId);
    if (!pricing) return;
    const clienteRow = await tx.cliente.findUnique({
      where: { id: input.clienteId },
      select: { tenantId: true },
    });
    const tenantId = clienteRow?.tenantId ?? 'default';
    const units = await tx.patioUnidade.findMany({
      where: { unidadeProcessoId: input.unidadeProcessoId },
      select: { unidadeIso: true, solicitacaoId: true },
    });

    for (const u of units) {
      const containerIso = normalizeContainerIso(u.unidadeIso).replace(/\s/g, '').toUpperCase();
      await assertNoConflictingBilling(tx, {
        containerIso,
        clienteId: input.clienteId,
        unidadeProcessoId: input.unidadeProcessoId,
        gateInId: input.gateInId,
      });
      const container = await this.ruleEngine.loadContainerContext(
        input.gateInId,
        containerIso,
        {
          unidadeProcessoId: input.unidadeProcessoId,
          solicitacaoId: u.solicitacaoId,
          tx,
          containerHint: input.containerHint,
        },
      );
      const exclusao = await flagsExclusaoAutomatica(tx, input.unidadeProcessoId);
      const evaluation = await this.evaluateGateInOrSkip(tenantId, {
        gateInAt: input.entradaEm,
        asOf: input.entradaEm,
        regras: pricing.regras,
        container,
        fase: 'GATE_IN',
        clienteId: input.clienteId,
        tabelaPrecoId: pricing.tabelaPrecoId,
        gateInId: input.gateInId ?? input.unidadeProcessoId,
        containerIso,
        omitirHandling: exclusao.omitirHandling,
        omitirEnergia: exclusao.omitirEnergia,
      });
      if (!evaluation) continue;

      const pf = await tx.preFatura.upsert({
        where: {
          unidadeProcessoId_containerIso_segmento: {
            unidadeProcessoId: input.unidadeProcessoId,
            containerIso,
            segmento: 0,
          },
        },
        create: {
          containerIso,
          clienteId: input.clienteId,
          unidadeProcessoId: input.unidadeProcessoId,
          gateInId: input.gateInId ?? null,
          gateInAt: input.entradaEm,
          valorAcumulado: toDecimal(0),
          diasCobrados: 0,
          status: StatusPreFatura.ABERTA,
        },
        update: {
          ...(input.gateInId ? { gateInId: input.gateInId } : {}),
        },
      });

      await this.ruleEngine.persistItens(pf.id, evaluation, tx, [
        EventoGatilhoTarifa.GATE_IN,
        EventoGatilhoTarifa.HANDLING,
      ]);
      const total = await this.totalComExtras(tx, {
        preFaturaId: pf.id,
        unidadeProcessoId: input.unidadeProcessoId,
        clienteId: input.clienteId,
        tenantId,
        containerIso,
      });
      await tx.preFatura.update({
        where: { id: pf.id },
        data: {
          valorAcumulado: toDecimal(total),
          diasCobrados: evaluation.diasFaturaveis,
          cobrancaInicioEm: this.ruleEngine.cobrancaInicioEm(input.entradaEm, evaluation.diasFreeTime),
        },
      });
    }
  }

  /** Pré-fatura do aluguel: relógio começa na saída da frota, sem estoque de pátio. */
  async openPreFaturasForAluguel(
    input: {
      unidadeProcessoId: string;
      clienteId: string;
      tenantId: string;
      unidadeIso: string;
      iniciadoEm: Date;
      tipoContainerCodigo: string;
      containerTamanho: string;
      item: AluguelItemLike;
    },
    tx: Prisma.TransactionClient,
  ) {
    const containerIso = normalizeContainerIso(input.unidadeIso).replace(/\s/g, '').toUpperCase();
    await assertNoConflictingBilling(tx, {
      containerIso,
      clienteId: input.clienteId,
      unidadeProcessoId: input.unidadeProcessoId,
    });
    const pf = await tx.preFatura.upsert({
      where: {
        unidadeProcessoId_containerIso_segmento: {
          unidadeProcessoId: input.unidadeProcessoId,
          containerIso,
          segmento: 0,
        },
      },
      create: {
        containerIso,
        clienteId: input.clienteId,
        unidadeProcessoId: input.unidadeProcessoId,
        gateInAt: input.iniciadoEm,
        valorAcumulado: toDecimal(0),
        diasCobrados: 0,
        status: StatusPreFatura.ABERTA,
      },
      update: {},
    });

    const evaluation = evaluateAluguelCycle({
      iniciadoEm: input.iniciadoEm,
      asOf: input.iniciadoEm,
      item: input.item,
      container: containerContextFromAluguel({
        tipoContainerCodigo: input.tipoContainerCodigo,
        containerTamanho: input.containerTamanho,
      }),
      fase: 'INICIO',
    });
    await this.ruleEngine.persistItens(pf.id, evaluation, tx, [EventoGatilhoTarifa.GATE_IN]);
    const total = await this.totalComExtras(tx, {
      preFaturaId: pf.id,
      unidadeProcessoId: input.unidadeProcessoId,
      clienteId: input.clienteId,
      tenantId: input.tenantId,
      containerIso,
    });
    await tx.preFatura.update({
      where: { id: pf.id },
      data: {
        valorAcumulado: toDecimal(total),
        diasCobrados: evaluation.diasFaturaveis,
        cobrancaInicioEm: this.ruleEngine.cobrancaInicioEm(input.iniciadoEm, evaluation.diasFreeTime),
      },
    });
  }

  async consolidateAluguel(
    input: {
      unidadeProcessoId: string;
      clienteId: string;
      tenantId: string;
      unidadeIso: string;
      iniciadoEm: Date;
      encerradoEm: Date;
      tipoContainerCodigo: string;
      containerTamanho: string;
      item: AluguelItemLike;
    },
    tx: Prisma.TransactionClient,
  ) {
    const preFaturas = await tx.preFatura.findMany({
      where: {
        unidadeProcessoId: input.unidadeProcessoId,
        fatura: { is: null },
        status: { in: [StatusPreFatura.ABERTA, StatusPreFatura.CONSOLIDADA] },
      },
    });

    const evaluation = evaluateAluguelCycle({
      iniciadoEm: input.iniciadoEm,
      asOf: input.encerradoEm,
      item: input.item,
      container: containerContextFromAluguel({
        tipoContainerCodigo: input.tipoContainerCodigo,
        containerTamanho: input.containerTamanho,
      }),
      fase: 'DEVOLUCAO',
    });

    for (const pf of preFaturas) {
      if (pf.status === StatusPreFatura.ABERTA) {
        await this.ruleEngine.persistItens(pf.id, evaluation, tx);
        const valorTotal = await this.totalComExtras(tx, {
          preFaturaId: pf.id,
          unidadeProcessoId: input.unidadeProcessoId,
          clienteId: input.clienteId,
          tenantId: input.tenantId,
          containerIso: pf.containerIso,
        });
        await tx.preFatura.update({
          where: { id: pf.id },
          data: {
            status: StatusPreFatura.CONSOLIDADA,
            diasCobrados: evaluation.diasFaturaveis,
            valorAcumulado: toDecimal(valorTotal),
            cobrancaInicioEm: this.ruleEngine.cobrancaInicioEm(input.iniciadoEm, evaluation.diasFreeTime),
          },
        });
      }

      const atual = await tx.preFatura.findUnique({ where: { id: pf.id } });
      const valorTotal = Number(atual?.valorAcumulado ?? 0);
      await tx.fatura.create({
        data: {
          tenantId: input.tenantId,
          preFaturaId: pf.id,
          clienteId: input.clienteId,
          valorTotal: toDecimal(valorTotal),
          dataEmissao: input.encerradoEm,
          statusPagamento: StatusPagamentoFatura.PENDENTE,
        },
      });
    }
  }

  /** Motor de provisão diária — IDs abertos (e legado: gate-in sem gate-out). */
  async runDailyProvision(asOf = new Date()) {
    const open = await this.prisma.preFatura.findMany({
      where: {
        status: StatusPreFatura.ABERTA,
        OR: [
          { unidadeProcesso: { status: 'ABERTO' } },
          { unidadeProcessoId: null, gateIn: { checkOut: null } },
        ],
      },
      include: {
        gateIn: { select: { dataHora: true } },
        unidadeProcesso: { select: { entradaEm: true, id: true, modalidade: true } },
        cliente: { select: { id: true, tenantId: true } },
      },
    });

    const skippedTenants = new Set<string>();
    let updated = 0;

    for (const pf of open) {
      const tenantId = pf.cliente.tenantId;

      if (pf.unidadeProcesso?.modalidade === 'ALUGUEL') {
        const ok = await this.provisionAluguelDaily(pf, asOf);
        if (ok) updated++;
        continue;
      }

      if (!skippedTenants.has(tenantId)) {
        const padrao = await this.prisma.tabelaPreco.findFirst({
          where: {
            tenantId,
            cadastroTabelaPreco: { isNot: null },
            OR: [{ padrao: true }, { ativa: true }],
          },
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
      const gateInAt = pf.gateInAt ?? pf.unidadeProcesso?.entradaEm ?? pf.gateIn?.dataHora;
      const container = await this.ruleEngine.loadContainerContext(pf.gateInId, pf.containerIso, {
        unidadeProcessoId: pf.unidadeProcessoId ?? pf.unidadeProcesso?.id,
      });

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
        gateInAt,
        asOf,
        regras: pricing.regras,
        container,
        fase: 'PROVISAO_DIARIA',
        clienteId: pf.clienteId,
        tabelaPrecoId: pricing.tabelaPrecoId,
        gateInId: pf.freeTimeZerado ? undefined : (pf.gateInId ?? pf.unidadeProcessoId ?? pf.id),
        containerIso: pf.containerIso,
        forcarDiasFreeTime: pf.freeTimeZerado ? 0 : undefined,
        ...(await flagsExclusaoAutomatica(this.prisma, pf.unidadeProcessoId ?? pf.unidadeProcesso?.id)),
      });

      await this.ruleEngine.persistItens(pf.id, diariaEval, undefined, [
        EventoGatilhoTarifa.DIARIA_ARMAZENAGEM,
        EventoGatilhoTarifa.SHIFTING_EXTRA,
        EventoGatilhoTarifa.ENERGIA_REEFER,
      ]);

      const total = await this.totalComExtras(this.prisma, {
        preFaturaId: pf.id,
        unidadeProcessoId: pf.unidadeProcessoId ?? pf.unidadeProcesso?.id,
        clienteId: pf.clienteId,
        tenantId,
        containerIso: pf.containerIso,
      });
      await this.prisma.preFatura.update({
        where: { id: pf.id },
        data: {
          diasCobrados: diariaEval.diasFaturaveis,
          valorAcumulado: toDecimal(total),
          cobrancaInicioEm: this.ruleEngine.cobrancaInicioEm(
            gateInAt,
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
    const freeTimeDias = diariaRegra?.diasFreeTime ?? 0;
    const valorDiaria = Number(diariaRegra?.valor ?? 0);

    let pf = await this.prisma.preFatura.findFirst({
      where: {
        containerIso,
        clienteId,
        status: StatusPreFatura.ABERTA,
        OR: [
          { unidadeProcesso: { status: 'ABERTO' } },
          { unidadeProcessoId: null, gateIn: { checkOut: null } },
        ],
      },
      orderBy: { gateInAt: 'desc' },
      include: {
        gateIn: { select: { dataHora: true } },
        unidadeProcesso: { select: { id: true, entradaEm: true } },
        itens: true,
      },
    });

    let gateInAt: Date;
    const status = StatusPreFatura.ABERTA;

    if (pf) {
      gateInAt = pf.unidadeProcesso?.entradaEm ?? pf.gateIn?.dataHora ?? pf.gateInAt;
    } else {
      const unit = await this.prisma.patioUnidade.findFirst({
        where: {
          unidadeIso: { equals: containerIso, mode: 'insensitive' },
          solicitacao: { clienteId },
          OR: [
            { unidadeProcesso: { status: 'ABERTO' } },
            { unidadeProcessoId: null, gateIn: { checkOut: null } },
          ],
        },
        include: {
          gateIn: { select: { dataHora: true } },
          unidadeProcesso: { select: { entradaEm: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (!unit) {
        const consolidated = await this.prisma.preFatura.findFirst({
          where: { containerIso, clienteId, status: StatusPreFatura.CONSOLIDADA },
          orderBy: { updatedAt: 'desc' },
          include: {
            gateIn: { select: { dataHora: true } },
            unidadeProcesso: { select: { entradaEm: true } },
            fatura: true,
            itens: true,
          },
        });
        if (consolidated) {
          return {
            ...this.toPortalView(
              consolidated.containerIso,
              StatusPreFatura.CONSOLIDADA,
              consolidated.unidadeProcesso?.entradaEm ??
                consolidated.gateIn?.dataHora ??
                consolidated.gateInAt,
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
            aviso: 'Fatura consolidada na saída do ID. Consulte Financeiro para NFS-e e boleto.',
            provisionado: false,
          };
        }
        throw new NotFoundException('Nenhuma provisão aberta para este contêiner');
      }
      gateInAt = unit.unidadeProcesso?.entradaEm ?? unit.gateIn?.dataHora ?? unit.createdAt;
    }

    const resolvedGateInId = pf?.gateInId ?? null;

    const container = await this.ruleEngine.loadContainerContext(resolvedGateInId, containerIso, {
      unidadeProcessoId: pf?.unidadeProcessoId ?? pf?.unidadeProcesso?.id,
    });

    const live = await this.ruleEngine.evaluateForContainerCycleWithTenant(tenantId, {
      gateInAt,
      asOf: new Date(),
      regras: pricing.regras,
      container,
      fase: 'PROVISAO_DIARIA',
      clienteId,
      tabelaPrecoId: pricing.tabelaPrecoId,
      gateInId: resolvedGateInId ?? pf?.unidadeProcessoId ?? containerIso,
      containerIso,
      ...(await flagsExclusaoAutomatica(this.prisma, pf?.unidadeProcessoId ?? pf?.unidadeProcesso?.id)),
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

  /** Saída do ID: congela pré-faturas e emite fatura. Idempotente se já consolidado. */
  async consolidateOnProcesso(
    unidadeProcessoId: string,
    saidaEm: Date,
    tx: Prisma.TransactionClient,
  ) {
    const preFaturas = await tx.preFatura.findMany({
      where: {
        unidadeProcessoId,
        fatura: { is: null },
        status: { in: [StatusPreFatura.ABERTA, StatusPreFatura.CONSOLIDADA] },
      },
      include: {
        fatura: { select: { id: true } },
        gateIn: { select: { dataHora: true } },
        unidadeProcesso: { select: { entradaEm: true } },
        itens: true,
      },
    });

    const processo = await tx.unidadeProcesso.findUnique({
      where: { id: unidadeProcessoId },
      select: { modalidade: true, entradaEm: true, unidadeIso: true },
    });
    if (processo?.modalidade === 'ALUGUEL') {
      const first = preFaturas[0];
      const pricing = await this.loadAluguelPricing(unidadeProcessoId, tx);
      if (first && pricing) {
        const clientePf = await tx.cliente.findUnique({
          where: { id: first.clienteId },
          select: { tenantId: true },
        });
        await this.consolidateAluguel(
          {
            unidadeProcessoId,
            clienteId: first.clienteId,
            tenantId: clientePf?.tenantId ?? 'default',
            unidadeIso: processo.unidadeIso,
            iniciadoEm: processo.entradaEm,
            encerradoEm: saidaEm,
            tipoContainerCodigo: pricing.tipoContainerCodigo,
            containerTamanho: pricing.containerTamanho,
            item: pricing.item,
          },
          tx,
        );
      }
      return;
    }

    for (const pf of preFaturas) {
      if (pf.fatura) continue;
      const entradaEm = pf.gateInAt ?? pf.unidadeProcesso?.entradaEm ?? pf.gateIn?.dataHora;
      if (!entradaEm) continue;
      const clientePf = await tx.cliente.findUnique({
        where: { id: pf.clienteId },
        select: { tenantId: true },
      });
      const tenantIdPf = clientePf?.tenantId ?? 'default';

      let valorTotal = Number(pf.valorAcumulado);
      let diasCobrados = pf.diasCobrados;

      if (pf.status === StatusPreFatura.ABERTA) {
        const pricing = await this.ruleEngine.resolvePricingForCliente(pf.clienteId);
        const container = await this.ruleEngine.loadContainerContext(pf.gateInId, pf.containerIso, {
          unidadeProcessoId,
        });
        const evaluation = await this.ruleEngine.evaluateForContainerCycleWithTenant(tenantIdPf, {
          gateInAt: entradaEm,
          asOf: saidaEm,
          regras: pricing.regras,
          container,
          fase: 'GATE_OUT',
          clienteId: pf.clienteId,
          tabelaPrecoId: pricing.tabelaPrecoId,
          gateInId: pf.freeTimeZerado ? undefined : (pf.gateInId ?? unidadeProcessoId),
          containerIso: pf.containerIso,
          forcarDiasFreeTime: pf.freeTimeZerado ? 0 : undefined,
          omitirGateIn: pf.segmento > 0,
          ...(await flagsExclusaoAutomatica(tx, unidadeProcessoId)),
        });

        await this.ruleEngine.persistItens(pf.id, evaluation, tx);
        valorTotal = await this.totalComExtras(tx, {
          preFaturaId: pf.id,
          unidadeProcessoId,
          clienteId: pf.clienteId,
          tenantId: tenantIdPf,
          containerIso: pf.containerIso,
        });
        diasCobrados = evaluation.diasFaturaveis;

        await tx.preFatura.update({
          where: { id: pf.id },
          data: {
            status: StatusPreFatura.CONSOLIDADA,
            diasCobrados,
            valorAcumulado: toDecimal(valorTotal),
            cobrancaInicioEm: this.ruleEngine.cobrancaInicioEm(entradaEm, evaluation.diasFreeTime),
          },
        });
      }

      const fatura = await tx.fatura.create({
        data: {
          tenantId: tenantIdPf,
          preFaturaId: pf.id,
          clienteId: pf.clienteId,
          valorTotal: toDecimal(valorTotal),
          dataEmissao: saidaEm,
          statusPagamento: StatusPagamentoFatura.PENDENTE,
        },
      });

      this.logger.log(
        `Saída ID rule engine: ${pf.containerIso} — R$ ${valorTotal.toFixed(2)} (fatura ${fatura.id})`,
      );
    }
  }

  /**
   * Pré-fatura ABERTA cujo ID já encerrou: tenta consolidar de novo e alerta o que restar.
   */
  async reconcileClosedProcessoPrefaturas() {
    const stale = await this.prisma.preFatura.findMany({
      where: {
        status: StatusPreFatura.ABERTA,
        unidadeProcesso: { status: 'ENCERRADO' },
      },
      include: {
        fatura: { select: { id: true } },
        unidadeProcesso: { select: { id: true, numero: true, saidaEm: true, updatedAt: true } },
      },
      take: 200,
    });

    const pending = stale.filter((pf) => !pf.fatura && pf.unidadeProcessoId);
    const byProcesso = new Map<string, (typeof pending)[number]>();
    for (const pf of pending) {
      const id = pf.unidadeProcessoId!;
      if (!byProcesso.has(id)) byProcesso.set(id, pf);
    }

    let consolidados = 0;
    const falhas: Array<{ unidadeProcessoId: string; numero: number | null; erro: string }> = [];

    for (const [unidadeProcessoId, sample] of byProcesso) {
      const saidaEm = sample.unidadeProcesso?.saidaEm ?? sample.unidadeProcesso?.updatedAt ?? new Date();
      try {
        await this.prisma.$transaction(async (tx) => {
          await this.consolidateOnProcesso(unidadeProcessoId, saidaEm, tx);
        });
        consolidados += 1;
      } catch (err) {
        const erro = err instanceof Error ? err.message : String(err);
        this.logger.error(`Reconciliação ID ${sample.unidadeProcesso?.numero ?? unidadeProcessoId}: ${erro}`);
        falhas.push({
          unidadeProcessoId,
          numero: sample.unidadeProcesso?.numero ?? null,
          erro: erro.slice(0, 300),
        });
      }
    }

    if (falhas.length) {
      await this.alerts.faturamentoReconcileFailed({
        falhas: falhas.length,
        consolidados,
        amostras: falhas.slice(0, 5),
      });
    }

    return {
      encontrados: pending.length,
      processos: byProcesso.size,
      consolidados,
      falhas: falhas.length,
    };
  }

  /** Gate-Out: congela pré-faturas e coloca o ID na fila da Fatura (sem emitir NFS-e). */
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
        gateInAt: pf.gateIn?.dataHora ?? pf.gateInAt,
        asOf: gateOutAt,
        regras: pricing.regras,
        container,
        fase: 'GATE_OUT',
        clienteId: pf.clienteId,
        tabelaPrecoId: pricing.tabelaPrecoId,
        gateInId,
        containerIso: pf.containerIso,
        ...(await flagsExclusaoAutomatica(tx, pf.unidadeProcessoId)),
      });

      await this.ruleEngine.persistItens(pf.id, evaluation, tx);
      const totalGate = await this.totalComExtras(tx, {
        preFaturaId: pf.id,
        unidadeProcessoId: pf.unidadeProcessoId,
        clienteId: pf.clienteId,
        tenantId: tenantIdPf,
        containerIso: pf.containerIso,
      });

      const consolidated = await tx.preFatura.update({
        where: { id: pf.id },
        data: {
          status: StatusPreFatura.CONSOLIDADA,
          diasCobrados: evaluation.diasFaturaveis,
          valorAcumulado: toDecimal(totalGate),
          cobrancaInicioEm: this.ruleEngine.cobrancaInicioEm(
            pf.gateIn?.dataHora ?? pf.gateInAt,
            evaluation.diasFreeTime,
          ),
        },
      });

      const fatura = await tx.fatura.create({
        data: {
          preFaturaId: consolidated.id,
          clienteId: pf.clienteId,
          valorTotal: toDecimal(totalGate),
          dataEmissao: gateOutAt,
          statusPagamento: StatusPagamentoFatura.PENDENTE,
        },
      });

      this.logger.log(
        `Gate-Out rule engine: ${pf.containerIso} — R$ ${evaluation.valorTotal.toFixed(2)} (fatura ${fatura.id})`,
      );
    }
  }

  /**
   * Cessão durante a estadia (porta dos fundos): o pagador vira B no mesmo ciclo.
   * Handling + diárias já provisionados e o restante até a saída saem numa fatura só, em B.
   * Free time e data de entrada da RIC original permanecem — não existe ciclo novo.
   */
  async transferOpenPrefaturaOnCessao(
    tx: Prisma.TransactionClient,
    input: {
      unidadeProcessoId: string;
      deClienteId: string;
      paraClienteId: string;
      cessaoId: string;
    },
  ): Promise<{ preFaturaId: string | null; valor: number }> {
    const aberta = await tx.preFatura.findFirst({
      where: {
        unidadeProcessoId: input.unidadeProcessoId,
        status: StatusPreFatura.ABERTA,
      },
      orderBy: { segmento: 'desc' },
    });
    if (!aberta) {
      return { preFaturaId: null, valor: 0 };
    }
    if (aberta.clienteId !== input.deClienteId) {
      throw new ConflictException(
        'A pré-fatura aberta deste ID não pertence ao titular atual. Recarregue e tente de novo.',
      );
    }

    await tx.preFatura.update({
      where: { id: aberta.id },
      data: {
        clienteId: input.paraClienteId,
        cessaoId: input.cessaoId,
        freeTimeZerado: false,
      },
    });

    return { preFaturaId: aberta.id, valor: Number(aberta.valorAcumulado) };
  }

  async clonarPrefaturaParaReemissao(
    tx: Prisma.TransactionClient,
    origemId: string,
    paraClienteId: string,
    cessaoId: string,
  ): Promise<{ destinoId: string; faturaId: string; valor: number }> {
    const origem = await tx.preFatura.findUnique({
      where: { id: origemId },
      include: { itens: true, unidadeProcesso: { select: { tenantId: true } } },
    });
    if (!origem) {
      throw new NotFoundException('Pré-fatura de origem não encontrada.');
    }
    const maxSeg = await tx.preFatura.aggregate({
      where: { unidadeProcessoId: origem.unidadeProcessoId ?? undefined },
      _max: { segmento: true },
    });
    const destino = await tx.preFatura.create({
      data: {
        containerIso: origem.containerIso,
        clienteId: paraClienteId,
        gateInId: null,
        unidadeProcessoId: origem.unidadeProcessoId,
        gateInAt: origem.gateInAt,
        valorAcumulado: origem.valorAcumulado,
        diasCobrados: origem.diasCobrados,
        status: StatusPreFatura.CONSOLIDADA,
        segmento: (maxSeg._max.segmento ?? origem.segmento) + 1,
        cessaoId,
        freeTimeZerado: origem.freeTimeZerado,
        cobrancaInicioEm: origem.cobrancaInicioEm,
        itens: {
          create: origem.itens.map((i) => ({
            eventoGatilho: i.eventoGatilho,
            descricao: i.descricao,
            quantidade: i.quantidade,
            valorUnitario: i.valorUnitario,
            valorTotal: i.valorTotal,
            regraTarifariaId: i.regraTarifariaId,
          })),
        },
      },
    });
    const valor = Number(origem.valorAcumulado);
    const tenantId = origem.unidadeProcesso?.tenantId ?? 'default';
    const fatura = await tx.fatura.create({
      data: {
        tenantId,
        preFaturaId: destino.id,
        clienteId: paraClienteId,
        valorTotal: origem.valorAcumulado,
        statusPagamento: StatusPagamentoFatura.PENDENTE,
      },
    });
    return { destinoId: destino.id, faturaId: fatura.id, valor };
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
        OR: [
          { unidadeProcesso: { status: 'ABERTO' } },
          { gateIn: { checkOut: null } },
        ],
      },
    });
    if (inYard) return true;
    throw new ForbiddenException('Contêiner não pertence ao tenant do cliente');
  }

  /** Recalcula a linha de handling com tarifa CHEIO (troca de status / transbordo). */
  async persistHandlingCheio(unidadeProcessoId: string): Promise<void> {
    if (await processoTemHandlingExcluido(this.prisma, unidadeProcessoId)) return;
    const pfs = await this.prisma.preFatura.findMany({
      where: { unidadeProcessoId, status: StatusPreFatura.ABERTA },
      include: { cliente: { select: { tenantId: true } } },
    });
    for (const pf of pfs) {
      const pricing = await this.ruleEngine.resolvePricingForCliente(pf.clienteId);
      const container = await this.ruleEngine.loadContainerContext(pf.gateInId, pf.containerIso, {
        unidadeProcessoId,
      });
      container.faturarHandlingComoCheio = true;
      const evaluation = await this.ruleEngine.evaluateForContainerCycleWithTenant(pf.cliente.tenantId, {
        gateInAt: pf.gateInAt,
        asOf: new Date(),
        regras: pricing.regras,
        container,
        fase: 'GATE_OUT',
        clienteId: pf.clienteId,
        tabelaPrecoId: pricing.tabelaPrecoId,
        gateInId: pf.gateInId ?? unidadeProcessoId,
        containerIso: pf.containerIso,
      });
      await this.ruleEngine.persistItens(pf.id, evaluation, undefined, [EventoGatilhoTarifa.HANDLING]);
      const total = await this.totalComExtras(this.prisma, {
        preFaturaId: pf.id,
        unidadeProcessoId,
        clienteId: pf.clienteId,
        tenantId: pf.cliente.tenantId,
        containerIso: pf.containerIso,
      });
      await this.prisma.preFatura.update({
        where: { id: pf.id },
        data: { valorAcumulado: toDecimal(total) },
      });
    }
  }

  async refreshExtrasForProcesso(unidadeProcessoId: string): Promise<void> {
    const pfs = await this.prisma.preFatura.findMany({
      where: { unidadeProcessoId, status: StatusPreFatura.ABERTA },
      include: { cliente: { select: { tenantId: true } } },
    });
    for (const pf of pfs) {
      const total = await this.totalComExtras(this.prisma, {
        preFaturaId: pf.id,
        unidadeProcessoId,
        clienteId: pf.clienteId,
        tenantId: pf.cliente.tenantId,
        containerIso: pf.containerIso,
      });
      await this.prisma.preFatura.update({
        where: { id: pf.id },
        data: { valorAcumulado: toDecimal(total) },
      });
    }
  }

  private async provisionAluguelDaily(
    pf: {
      id: string;
      clienteId: string;
      containerIso: string;
      gateInAt: Date;
      unidadeProcessoId: string | null;
      unidadeProcesso?: { entradaEm: Date; id: string } | null;
      cliente: { tenantId: string };
    },
    asOf: Date,
  ): Promise<boolean> {
    const processoId = pf.unidadeProcessoId ?? pf.unidadeProcesso?.id;
    if (!processoId) return false;
    const pricing = await this.loadAluguelPricing(processoId);
    if (!pricing) {
      this.logger.warn(`Aluguel sem item de preço no ID ${processoId}`);
      return false;
    }
    const iniciadoEm = pf.unidadeProcesso?.entradaEm ?? pf.gateInAt;
    const evaluation = evaluateAluguelCycle({
      iniciadoEm,
      asOf,
      item: pricing.item,
      container: containerContextFromAluguel({
        tipoContainerCodigo: pricing.tipoContainerCodigo,
        containerTamanho: pricing.containerTamanho,
      }),
      fase: 'DIARIA',
    });
    await this.ruleEngine.persistItens(pf.id, evaluation, undefined, [
      EventoGatilhoTarifa.DIARIA_ARMAZENAGEM,
    ]);
    const total = await this.totalComExtras(this.prisma, {
      preFaturaId: pf.id,
      unidadeProcessoId: processoId,
      clienteId: pf.clienteId,
      tenantId: pf.cliente.tenantId,
      containerIso: pf.containerIso,
    });
    await this.prisma.preFatura.update({
      where: { id: pf.id },
      data: {
        diasCobrados: evaluation.diasFaturaveis,
        valorAcumulado: toDecimal(total),
        cobrancaInicioEm: this.ruleEngine.cobrancaInicioEm(iniciadoEm, evaluation.diasFreeTime),
      },
    });
    return true;
  }

  private async loadAluguelPricing(
    unidadeProcessoId: string,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const aluguel = await db.aluguel.findUnique({
      where: { unidadeProcessoId },
      include: {
        unidadeAluguel: true,
        tabelaAluguel: { include: { itens: { where: { deletedAt: null, ativo: true } } } },
      },
    });
    if (!aluguel) return null;
    const item = matchAluguelItem(
      aluguel.tabelaAluguel.itens.map((i) => ({
        tipoContainerCodigo: i.tipoContainerCodigo,
        containerTamanho: i.containerTamanho,
        valorDiaria: Number(i.valorDiaria),
        diasFreeTime: i.diasFreeTime,
        valorHandling: Number(i.valorHandling),
        faixasDiaria: i.faixasDiaria,
        ativo: i.ativo,
      })),
      aluguel.unidadeAluguel.tipoContainerCodigo,
      aluguel.unidadeAluguel.containerTamanho,
    );
    if (!item) return null;
    return {
      item,
      tipoContainerCodigo: aluguel.unidadeAluguel.tipoContainerCodigo,
      containerTamanho: aluguel.unidadeAluguel.containerTamanho,
    };
  }

  private async totalComExtras(
    db: Prisma.TransactionClient | PrismaService,
    input: {
      preFaturaId: string;
      unidadeProcessoId?: string | null;
      clienteId: string;
      tenantId: string;
      containerIso: string;
    },
  ): Promise<number> {
    await syncExtrasOnPreFatura(db, input);
    return this.ruleEngine.sumItensTotal(input.preFaturaId, db as Prisma.TransactionClient);
  }
}
