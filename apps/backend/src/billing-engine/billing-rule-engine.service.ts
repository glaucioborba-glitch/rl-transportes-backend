import { Injectable, Logger } from '@nestjs/common';
import {
  EventoGatilhoTarifa,
  PatioTomadaEventType,
  Prisma,
  StatusContainer,
  StatusContainerTarifa,
  type RegraTarifaria,
  type TabelaPreco,
  TipoContainerTarifa,
} from '@prisma/client';
import { addCalendarDays } from '../armazenagem-faturamento/armazenagem-billing.util';
import { DEFAULT_FREE_TIME_DIAS, DEFAULT_VALOR_DIARIA } from '../armazenagem-faturamento/armazenagem-billing.util';
import { PrismaService } from '../prisma/prisma.service';
import { TenantConfigService } from '../tenant/tenant-config.service';
import { resolveOperacional } from '../tenant/tenant-config.types';
import type {
  BillingRuleEngineInput,
  BillingRuleEngineResult,
  ContainerBillingContext,
} from './billing-rule-engine.types';
import {
  computeDiasEnergiaFromTomadaEvents,
  DEFAULT_TARIFA_ENERGIA_REEFER_DIA,
  diffDiasCalendario,
  evaluateBillingRules,
  extractContainerMdmKeys,
  inferTipoContainer,
  pickRegra,
  resolveDiasEnergiaReefer,
} from './billing-rule-engine.util';
import { parseFaixasDiaria } from './faixa-diaria.types';
import { resolveFaixasFromCadastroItem } from './faixa-diaria-calculator';

export type ResolvedPricingTable = {
  source: 'TABELA_PRECO' | 'DEFAULT';
  tabelaPrecoId?: string;
  regras: RegraTarifaria[];
};

export type ContainerPricingOverrides = {
  diasFreeTime: number;
  valorDiaria: number;
  valorEnergiaReefer: number;
  faixasDiaria?: import('./faixa-diaria.types').FaixaDiaria[];
};

@Injectable()
export class BillingRuleEngineService {
  private readonly logger = new Logger(BillingRuleEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantConfig: TenantConfigService,
  ) {}

  async resolvePricingForCliente(clienteId: string): Promise<ResolvedPricingTable> {
    const cliente = await this.prisma.cliente.findFirst({
      where: { id: clienteId, deletedAt: null },
      include: {
        tabelaPreco: {
          include: { regras: { where: { ativa: true }, orderBy: { createdAt: 'asc' } } },
        },
      },
    });
    if (!cliente) {
      return this.resolveDefaultTable();
    }

    if (cliente.tabelaPreco?.ativa && cliente.tabelaPreco.regras.length) {
      return {
        source: 'TABELA_PRECO',
        tabelaPrecoId: cliente.tabelaPreco.id,
        regras: cliente.tabelaPreco.regras,
      };
    }

    const padrao = await this.prisma.tabelaPreco.findFirst({
      where: { tenantId: cliente.tenantId, padrao: true, ativa: true },
      include: { regras: { where: { ativa: true }, orderBy: { createdAt: 'asc' } } },
    });
    if (padrao?.regras.length) {
      return {
        source: 'TABELA_PRECO',
        tabelaPrecoId: padrao.id,
        regras: padrao.regras,
      };
    }

    this.logger.warn(
      `Cliente ${clienteId} sem tabela comercial nem padrão — usando regras DEFAULT. Configure em /cadastros/financeiro/tabelas-precos.`,
    );
    return this.resolveDefaultTable();
  }

  private async resolveDefaultTable(): Promise<ResolvedPricingTable> {
    const padrao = await this.prisma.tabelaPreco.findFirst({
      where: { tenantId: 'default', padrao: true, ativa: true },
      include: { regras: { where: { ativa: true }, orderBy: { createdAt: 'asc' } } },
    });
    if (padrao?.regras.length) {
      return {
        source: 'TABELA_PRECO',
        tabelaPrecoId: padrao.id,
        regras: padrao.regras,
      };
    }
    return { source: 'DEFAULT', regras: this.defaultRegras() };
  }

  /**
   * PR-03: Hierarquia de regra tarifária (específica > tipo/AMBOS > global).
   */
  resolveBillingRule(
    regras: RegraTarifaria[],
    tipoContainer: TipoContainerTarifa,
    evento: EventoGatilhoTarifa,
    statusContainer: StatusContainerTarifa | null,
  ): RegraTarifaria | undefined {
    return pickRegra(regras, tipoContainer, evento, statusContainer) as RegraTarifaria | undefined;
  }

  /** PR-03: Free time — item cadastral > regra tarifária > tenant default. */
  async resolveFreeTime(
    tenantId: string,
    clienteId: string,
    tabelaPrecoId: string | undefined,
    container: ContainerBillingContext,
    regras: RegraTarifaria[],
  ): Promise<number> {
    const tipo = inferTipoContainer(container);
    const status = this.normalizeStatus(container.statusContainer);
    const mdm = extractContainerMdmKeys(container);

    const cadastroItem = await this.findCadastroBillingItem(clienteId, mdm, status);
    if (cadastroItem?.freeTimeDias != null) {
      return cadastroItem.freeTimeDias;
    }

    const regra = this.resolveBillingRule(
      regras,
      tipo,
      EventoGatilhoTarifa.DIARIA_ARMAZENAGEM,
      status,
    );
    if (regra) return regra.diasFreeTime;

    const params = await this.tenantConfig.getParametros(tenantId);
    return resolveOperacional(params.parametros).freeTimePadraoDias ?? DEFAULT_FREE_TIME_DIAS;
  }

  /** PR-03: Tarifa diária — item cadastral > regra > default. */
  async resolveTarifaDiaria(
    tenantId: string,
    clienteId: string,
    container: ContainerBillingContext,
    regras: RegraTarifaria[],
  ): Promise<number> {
    const tipo = inferTipoContainer(container);
    const status = this.normalizeStatus(container.statusContainer);
    const mdm = extractContainerMdmKeys(container);

    const cadastroItem = await this.findCadastroBillingItem(clienteId, mdm, status);
    if (cadastroItem?.tarifaDiariaArmazenagem != null) {
      return Number(cadastroItem.tarifaDiariaArmazenagem);
    }

    const regra = this.resolveBillingRule(
      regras,
      tipo,
      EventoGatilhoTarifa.DIARIA_ARMAZENAGEM,
      status,
    );
    if (regra) return Number(regra.valor);

    return DEFAULT_VALOR_DIARIA;
  }

  /** PR-03: Tarifa energia reefer — item cadastral > regra > default. */
  async resolveTarifaEnergiaReefer(
    clienteId: string,
    container: ContainerBillingContext,
    regras: RegraTarifaria[],
  ): Promise<number> {
    const tipo = inferTipoContainer(container);
    const status = this.normalizeStatus(container.statusContainer);
    const mdm = extractContainerMdmKeys(container);

    const cadastroItem = await this.findCadastroBillingItem(clienteId, mdm, status);
    if (cadastroItem?.tarifaEnergiaReeferDiaria != null) {
      return Number(cadastroItem.tarifaEnergiaReeferDiaria);
    }

    const regra = this.resolveBillingRule(
      regras,
      tipo,
      EventoGatilhoTarifa.ENERGIA_REEFER,
      status,
    );
    if (regra) return Number(regra.valor);

    return DEFAULT_TARIFA_ENERGIA_REEFER_DIA;
  }

  /** Resolve overrides completos para evaluateBillingRules. */
  async resolveContainerPricingOverrides(
    tenantId: string,
    clienteId: string,
    tabelaPrecoId: string | undefined,
    container: ContainerBillingContext,
    regras: RegraTarifaria[],
  ): Promise<ContainerPricingOverrides> {
    const [diasFreeTime, valorDiaria, valorEnergiaReefer, faixasDiaria] = await Promise.all([
      this.resolveFreeTime(tenantId, clienteId, tabelaPrecoId, container, regras),
      this.resolveTarifaDiaria(tenantId, clienteId, container, regras),
      this.resolveTarifaEnergiaReefer(clienteId, container, regras),
      this.resolveFaixasDiaria(clienteId, container, regras),
    ]);
    return { diasFreeTime, valorDiaria, valorEnergiaReefer, faixasDiaria };
  }

  async resolveFaixasDiaria(
    clienteId: string,
    container: ContainerBillingContext,
    regras: RegraTarifaria[],
  ) {
    const tipo = inferTipoContainer(container);
    const status = this.normalizeStatus(container.statusContainer);
    const mdm = extractContainerMdmKeys(container);

    const cadastroItem = await this.findCadastroBillingItem(clienteId, mdm, status);
    if (cadastroItem) {
      return resolveFaixasFromCadastroItem({
        faixasDiaria: cadastroItem.faixasDiaria,
        tarifaDiariaArmazenagem:
          cadastroItem.tarifaDiariaArmazenagem != null
            ? Number(cadastroItem.tarifaDiariaArmazenagem)
            : null,
        freeTimeDias: cadastroItem.freeTimeDias,
      });
    }

    const regra = pickRegra(
      regras as never,
      tipo,
      EventoGatilhoTarifa.DIARIA_ARMAZENAGEM,
      status,
      mdm,
    );
    const parsed = regra ? parseFaixasDiaria(regra.faixasDiaria) : [];
    return parsed.length ? parsed : undefined;
  }

  evaluate(input: BillingRuleEngineInput): BillingRuleEngineResult {
    return evaluateBillingRules(input);
  }

  async evaluateForContainerCycle(params: {
    gateInAt: Date;
    asOf: Date;
    regras: RegraTarifaria[];
    container: ContainerBillingContext;
    fase: 'GATE_IN' | 'PROVISAO_DIARIA' | 'GATE_OUT';
    shiftingExtras?: number;
    tenantId?: string;
    clienteId?: string;
    tabelaPrecoId?: string;
    gateInId?: string;
    containerIso?: string;
  }): Promise<BillingRuleEngineResult> {
    const incluirGateIn = params.fase === 'GATE_IN' || params.fase === 'GATE_OUT';
    const incluirGateOut = params.fase === 'GATE_OUT';
    const shiftingExtras =
      params.fase === 'GATE_OUT' ? params.shiftingExtras : params.fase === 'PROVISAO_DIARIA' ? 0 : 0;

    let pricingOverrides: ContainerPricingOverrides | undefined;
    if (params.tenantId && params.clienteId) {
      pricingOverrides = await this.resolveContainerPricingOverrides(
        params.tenantId,
        params.clienteId,
        params.tabelaPrecoId,
        params.container,
        params.regras,
      );
    }

    const diasEnergiaReefer = await this.resolveDiasEnergiaReeferForCycle({
      container: params.container,
      gateInAt: params.gateInAt,
      asOf: params.asOf,
      gateInId: params.gateInId,
      containerIso: params.containerIso,
    });

    return this.evaluate({
      gateInAt: params.gateInAt,
      asOf: params.asOf,
      regras: params.regras,
      container: params.container,
      incluirGateIn,
      incluirGateOut,
      shiftingExtras,
      pricingOverrides,
      diasEnergiaReefer,
    });
  }

  /**
   * Dias de energia: histórico CONECTADO/DESCONECTADO do pátio;
   * sem histórico, fallback para flag `refrigerado` da solicitação.
   */
  async resolveDiasEnergiaReeferForCycle(params: {
    container: ContainerBillingContext;
    gateInAt: Date;
    asOf: Date;
    gateInId?: string;
    containerIso?: string;
  }): Promise<number> {
    const diasNoPatio = diffDiasCalendario(params.gateInAt, params.asOf);

    if (!params.gateInId || !params.containerIso) {
      return resolveDiasEnergiaReefer({
        diasNoPatio,
        refrigerado: params.container.refrigerado,
      });
    }

    const iso = params.containerIso.replace(/\s/g, '').toUpperCase();
    const unit = await this.prisma.patioUnidade.findFirst({
      where: { gateInId: params.gateInId, unidadeIso: iso },
      include: {
        tomadaEventos: {
          where: {
            tipo: { in: [PatioTomadaEventType.CONECTADO, PatioTomadaEventType.DESCONECTADO] },
          },
          orderBy: { createdAt: 'asc' },
          select: { tipo: true, createdAt: true },
        },
      },
    });

    if (unit?.tomadaEventos?.length) {
      return computeDiasEnergiaFromTomadaEvents(
        unit.tomadaEventos.map((e) => ({
          tipo: e.tipo as 'CONECTADO' | 'DESCONECTADO',
          at: e.createdAt,
        })),
        params.asOf,
      );
    }

    return resolveDiasEnergiaReefer({
      diasNoPatio,
      refrigerado: params.container.refrigerado || unit?.refrigerado,
    });
  }

  /** Carrega pricing e aplica dias corridos (PR-02 — fim de semana não afeta diárias). */
  async evaluateForContainerCycleWithTenant(
    tenantId: string,
    params: Omit<
      Parameters<BillingRuleEngineService['evaluateForContainerCycle']>[0],
      'tenantId'
    > & { clienteId?: string },
  ): Promise<BillingRuleEngineResult> {
    return this.evaluateForContainerCycle({ ...params, tenantId });
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

    const statusFromPatio = unit.statusContainer;
    const statusFromForm = fromForm?.status;

    return {
      tamanho: fromForm?.tamanho ?? '40',
      tipo: fromForm?.tipo ?? 'DRY',
      refrigerado: fromForm?.refrigerado ?? unit.refrigerado,
      setPoint: fromForm?.setPoint ?? null,
      statusContainer: this.mapContainerStatus(statusFromForm ?? statusFromPatio),
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
        EventoGatilhoTarifa.HANDLING,
        EventoGatilhoTarifa.DIARIA_ARMAZENAGEM,
        EventoGatilhoTarifa.SHIFTING_EXTRA,
        EventoGatilhoTarifa.ENERGIA_REEFER,
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

  private mapContainerStatus(
    status?: StatusContainer | StatusContainerTarifa | null,
  ): StatusContainerTarifa | null {
    if (!status || status === StatusContainerTarifa.AMBOS) return null;
    const s = String(status);
    if (s === 'CHEIO') return StatusContainerTarifa.CHEIO;
    if (s === 'VAZIO') return StatusContainerTarifa.VAZIO;
    return null;
  }

  private normalizeStatus(
    status?: StatusContainerTarifa | null,
  ): StatusContainerTarifa | null {
    if (!status || status === StatusContainerTarifa.AMBOS) return null;
    return status;
  }

  private mapContainerToCadastroKeys(
    container: ContainerBillingContext,
    tipo: TipoContainerTarifa,
  ): { tipoCodigo: string; tamanho: string } {
    const tamanhoRaw = (container.tamanho ?? '40').replace(/\D/g, '');
    const tamanho = tamanhoRaw ? `${tamanhoRaw}'` : "40'";
    let tipoCodigo = (container.tipo ?? 'DRY').toUpperCase();
    if (tipo === TipoContainerTarifa.REEFER) tipoCodigo = 'REEFER';
    if (tipo === TipoContainerTarifa.IMO_PERIGOSA) tipoCodigo = 'IMO';
    return { tipoCodigo, tamanho };
  }

  private async findCadastroBillingItem(
    clienteId: string,
    mdm: { tipoCodigo?: string | null; capacidadeCodigo?: string | null; containerTamanho?: string | null },
    status: StatusContainerTarifa | null,
  ) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const tabelas = await this.prisma.cadastroTabelaPreco.findMany({
      where: {
        deletedAt: null,
        ativo: true,
        dataInicio: { lte: hoje },
        AND: [
          { OR: [{ dataFim: null }, { dataFim: { gte: hoje } }] },
          { OR: [{ clienteId }, { clienteId: null }] },
        ],
      },
      include: { itens: true },
      orderBy: [{ clienteId: 'desc' }, { dataInicio: 'desc' }],
    });

    const statusesToTry: StatusContainerTarifa[] = status
      ? [status, StatusContainerTarifa.AMBOS]
      : [StatusContainerTarifa.AMBOS];

    for (const tabela of tabelas) {
      for (const st of statusesToTry) {
        const item = tabela.itens.find((i) =>
          this.cadastroItemMatches(i, mdm, st),
        );
        if (item) return item;
      }
    }
    return null;
  }

  private cadastroItemMatches(
    item: {
      categoriaItem?: string;
      tipoOperacaoCodigo?: string;
      tipoContainerCodigo: string | null;
      capacidadeCodigo?: string | null;
      containerTamanho: string | null;
      statusContainer: StatusContainerTarifa;
      freeTimeDias: number | null;
      faixasDiaria?: unknown;
      tarifaDiariaArmazenagem: Prisma.Decimal | null;
      tarifaEnergiaReeferDiaria: Prisma.Decimal | null;
      valorHandling?: Prisma.Decimal | null;
    },
    mdm: { tipoCodigo?: string | null; capacidadeCodigo?: string | null; containerTamanho?: string | null },
    status: StatusContainerTarifa,
  ): boolean {
    const isArmazenagem =
      item.categoriaItem === 'ARMAZENAGEM' ||
      item.tipoOperacaoCodigo?.toUpperCase() === 'ARMAZENAGEM';
    if (!isArmazenagem) return false;

    const tipoKey = mdm.tipoCodigo?.toUpperCase();
    const tc = item.tipoContainerCodigo?.toUpperCase();
    if (tc && tc !== '*' && tc !== tipoKey) return false;

    const cap = item.capacidadeCodigo?.toUpperCase();
    const capKey = mdm.capacidadeCodigo?.toUpperCase();
    if (cap && cap !== '*' && cap !== capKey) return false;

    const tam = item.containerTamanho;
    if (tam && tam !== '*' && tam !== mdm.containerTamanho) return false;

    if (item.statusContainer !== StatusContainerTarifa.AMBOS && item.statusContainer !== status) {
      return false;
    }

    return (
      item.freeTimeDias != null ||
      item.faixasDiaria != null ||
      item.tarifaDiariaArmazenagem != null ||
      item.tarifaEnergiaReeferDiaria != null ||
      item.valorHandling != null
    );
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
        statusContainer: StatusContainerTarifa.AMBOS,
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
