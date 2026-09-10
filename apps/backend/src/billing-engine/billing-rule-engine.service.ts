import { Injectable, Logger, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
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
  diffDiasCalendario,
  evaluateBillingRules,
  extractContainerMdmKeys,
  inferTipoContainer,
  pickRegra,
  resolveDiasEnergiaReefer,
} from './billing-rule-engine.util';
import { parseFaixasDiaria } from './faixa-diaria.types';
import { resolveFaixasFromCadastroItem, resolveFaixasEnergiaFromCadastroItem } from './faixa-diaria-calculator';
import {
  resolveCadastroTabelaVigente,
  resolveCadastroTabelasCandidatas,
  resolveBillingTabelaPrecoIdPadrao,
} from '../cadastros/cadastro-tabela-preco-vigente';
import { statusParaHandling } from '../cadastros/servico-efeito';

export type ResolvedPricingTable = {
  source: 'TABELA_PRECO' | 'DEFAULT';
  tabelaPrecoId?: string;
  regras: RegraTarifaria[];
};

export type ContainerPricingOverrides = {
  diasFreeTime: number;
  valorDiaria: number;
  valorHandling?: number;
  valorEnergiaReefer: number;
  energiaUsaFatorSetPoint?: boolean;
  faixasDiaria?: import('./faixa-diaria.types').FaixaDiaria[];
  faixasEnergiaReefer?: import('./faixa-diaria.types').FaixaDiaria[];
};

@Injectable()
export class BillingRuleEngineService {
  private readonly logger = new Logger(BillingRuleEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantConfig: TenantConfigService,
  ) {}

  async resolvePricingForCliente(clienteId: string): Promise<ResolvedPricingTable> {
    const fromCadastro = await this.loadRegrasFromCadastroVigente(clienteId);
    if (fromCadastro) return fromCadastro;

    const cliente = await this.prisma.cliente.findFirst({
      where: { id: clienteId, deletedAt: null },
      include: {
        tabelaPreco: {
          include: { regras: { where: { ativa: true }, orderBy: { createdAt: 'asc' } } },
        },
      },
    });
    if (!cliente) {
      throw new NotFoundException(`Cliente ${clienteId} não encontrado para faturar.`);
    }

    if (cliente.tabelaPreco?.ativa && cliente.tabelaPreco.regras.length) {
      return {
        source: 'TABELA_PRECO',
        tabelaPrecoId: cliente.tabelaPreco.id,
        regras: cliente.tabelaPreco.regras,
      };
    }

    return this.resolveDefaultTable(cliente.tenantId);
  }

  private async resolveDefaultTable(tenantId = 'default'): Promise<ResolvedPricingTable> {
    const billingId = await resolveBillingTabelaPrecoIdPadrao(this.prisma, tenantId);
    if (billingId) {
      const padrao = await this.prisma.tabelaPreco.findFirst({
        where: { id: billingId, ativa: true },
        include: { regras: { where: { ativa: true }, orderBy: { createdAt: 'asc' } } },
      });
      if (padrao?.regras.length) {
        return {
          source: 'TABELA_PRECO',
          tabelaPrecoId: padrao.id,
          regras: padrao.regras,
        };
      }
    }
    throw new UnprocessableEntityException(
      `Tabela padrão de preços ausente ou sem regras (tenant ${tenantId}). Configure em Cadastros → Tabelas de preços.`,
    );
  }

  /** Prefere a tabela cadastral vigente (a mesma da tela de cadastro / Forma e prazo). */
  private async loadRegrasFromCadastroVigente(clienteId: string): Promise<ResolvedPricingTable | null> {
    const cadastro = await resolveCadastroTabelaVigente(this.prisma, clienteId);
    if (!cadastro?.billingTabelaPrecoId) return null;
    const tabela = await this.prisma.tabelaPreco.findFirst({
      where: { id: cadastro.billingTabelaPrecoId, ativa: true },
      include: { regras: { where: { ativa: true }, orderBy: { createdAt: 'asc' } } },
    });
    if (!tabela?.regras.length) return null;
    return {
      source: 'TABELA_PRECO',
      tabelaPrecoId: tabela.id,
      regras: tabela.regras,
    };
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
    return resolveOperacional(params.parametros).freeTimePadraoDias ?? 0;
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

    throw new UnprocessableEntityException(
      'Tabela de preços sem diária de armazenagem para este tipo de contêiner. Ajuste a tabela padrão ou a tabela do cliente.',
    );
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

    return 0;
  }

  /** Resolve overrides completos para evaluateBillingRules. */
  async resolveContainerPricingOverrides(
    tenantId: string,
    clienteId: string,
    tabelaPrecoId: string | undefined,
    container: ContainerBillingContext,
    regras: RegraTarifaria[],
  ): Promise<ContainerPricingOverrides> {
    const [diasFreeTime, valorDiaria, valorHandling, valorEnergiaReefer, faixasDiaria, faixasEnergiaReefer] =
      await Promise.all([
        this.resolveFreeTime(tenantId, clienteId, tabelaPrecoId, container, regras),
        this.resolveTarifaDiaria(tenantId, clienteId, container, regras),
        this.resolveValorHandling(clienteId, container, regras),
        this.resolveTarifaEnergiaReefer(clienteId, container, regras),
        this.resolveFaixasDiaria(clienteId, container, regras),
        this.resolveFaixasEnergia(clienteId, container, regras),
      ]);
    return {
      diasFreeTime,
      valorDiaria,
      valorHandling,
      valorEnergiaReefer,
      energiaUsaFatorSetPoint: false,
      faixasDiaria,
      faixasEnergiaReefer,
    };
  }

  /** Handling do item cadastral (matriz) > regra tarifária. */
  async resolveValorHandling(
    clienteId: string,
    container: ContainerBillingContext,
    regras: RegraTarifaria[],
  ): Promise<number | undefined> {
    const tipo = inferTipoContainer(container);
    const status = statusParaHandling(
      this.normalizeStatus(container.statusContainer),
      container.faturarHandlingComoCheio,
    );
    const mdm = extractContainerMdmKeys(container);

    const cadastroItem = await this.findCadastroBillingItem(clienteId, mdm, status);
    if (cadastroItem?.valorHandling != null) {
      return Number(cadastroItem.valorHandling);
    }

    const regra = this.resolveBillingRule(regras, tipo, EventoGatilhoTarifa.HANDLING, status);
    if (regra) return Number(regra.valor);
    return undefined;
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

  async resolveFaixasEnergia(
    clienteId: string,
    container: ContainerBillingContext,
    regras: RegraTarifaria[],
  ) {
    const status = this.normalizeStatus(container.statusContainer);
    const mdm = extractContainerMdmKeys(container);

    const cadastroItem = await this.findCadastroBillingItem(clienteId, mdm, status);
    if (cadastroItem) {
      const faixas = resolveFaixasEnergiaFromCadastroItem({
        faixasEnergiaReefer: cadastroItem.faixasEnergiaReefer,
        tarifaEnergiaReeferDiaria:
          cadastroItem.tarifaEnergiaReeferDiaria != null
            ? Number(cadastroItem.tarifaEnergiaReeferDiaria)
            : null,
      });
      if (faixas.length) return faixas;
    }

    const regra = pickRegra(
      regras as never,
      TipoContainerTarifa.REEFER,
      EventoGatilhoTarifa.ENERGIA_REEFER,
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
    /** Segmento após cessão: não cobra GATE_IN de novo (já ficou no segmento do solicitante). */
    omitirGateIn?: boolean;
    forcarDiasFreeTime?: number;
  }): Promise<BillingRuleEngineResult> {
    const incluirGateIn =
      !params.omitirGateIn && (params.fase === 'GATE_IN' || params.fase === 'GATE_OUT');
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
    if (params.forcarDiasFreeTime != null) {
      pricingOverrides = {
        ...(pricingOverrides ?? {
          diasFreeTime: 0,
          valorDiaria: 0,
          valorEnergiaReefer: 0,
        }),
        diasFreeTime: params.forcarDiasFreeTime,
      };
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
    gateInId: string | null | undefined,
    containerIso: string,
    opts?: { unidadeProcessoId?: string | null; solicitacaoId?: string | null },
  ): Promise<ContainerBillingContext> {
    const isoNorm = containerIso.replace(/\s/g, '').toUpperCase();
    const or: Prisma.PatioUnidadeWhereInput[] = [];
    if (gateInId) or.push({ gateInId });
    if (opts?.unidadeProcessoId) or.push({ unidadeProcessoId: opts.unidadeProcessoId });
    if (opts?.solicitacaoId) or.push({ solicitacaoId: opts.solicitacaoId });

    const unit = await this.prisma.patioUnidade.findFirst({
      where: {
        unidadeIso: isoNorm,
        ...(or.length ? { OR: or } : {}),
      },
      include: {
        solicitacao: {
          include: { containersSolicitacao: true },
        },
      },
    });
    if (!unit) {
      const processoFlag = await this.prisma.unidadeProcesso.findFirst({
        where: {
          ...(opts?.unidadeProcessoId
            ? { id: opts.unidadeProcessoId }
            : { unidadeIso: isoNorm, status: 'ABERTO' }),
        },
        select: { faturarHandlingComoCheio: true },
      });
      return {
        tamanho: '40',
        tipo: 'DRY',
        refrigerado: false,
        faturarHandlingComoCheio: processoFlag?.faturarHandlingComoCheio ?? false,
      };
    }

    const fromForm = unit.solicitacao.containersSolicitacao.find(
      (c) => c.unidade.replace(/\s/g, '').toUpperCase() === isoNorm,
    );

    const statusFromPatio = unit.statusContainer;
    const statusFromForm = fromForm?.status;

    const processoFlag = await this.prisma.unidadeProcesso.findFirst({
      where: {
        ...(opts?.unidadeProcessoId
          ? { id: opts.unidadeProcessoId }
          : { unidadeIso: isoNorm, status: 'ABERTO' }),
      },
      select: { faturarHandlingComoCheio: true },
    });

    return {
      tamanho: fromForm?.tamanho ?? '40',
      tipo: fromForm?.tipo ?? 'DRY',
      refrigerado: fromForm?.refrigerado ?? unit.refrigerado,
      setPoint: fromForm?.setPoint ?? null,
      statusContainer: this.mapContainerStatus(statusFromForm ?? statusFromPatio),
      faturarHandlingComoCheio: processoFlag?.faturarHandlingComoCheio ?? false,
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
        descricao: item.detalheCobranca
          ? `${item.descricao} — ${item.detalheCobranca}`
          : item.descricao,
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
    const tabelas = await resolveCadastroTabelasCandidatas(this.prisma, clienteId);

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
      faixasEnergiaReefer?: unknown;
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
      item.faixasEnergiaReefer != null ||
      item.valorHandling != null
    );
  }
}

export type { TabelaPreco };
