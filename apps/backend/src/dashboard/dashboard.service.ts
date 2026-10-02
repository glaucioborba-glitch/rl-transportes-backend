import { Injectable } from '@nestjs/common';
import { AcaoAuditoria, Prisma, Role, StatusSolicitacao } from '@prisma/client';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { parseRelatorioInicioFim } from '../common/utils/relatorio-periodo';
import { PrismaService } from '../prisma/prisma.service';
import type { DashboardKpisPeriodo } from './dto/dashboard-kpis-query.dto';
import type { DashboardKpisDto } from './dto/dashboard-kpis.dto';
import type { DashboardQueryDto } from './dto/dashboard-query.dto';
import type {
  DashboardClientesDto,
  DashboardConflitosDto,
  DashboardFilasDto,
  DashboardFilaItemDto,
  DashboardOperacionalResponseDto,
  DashboardOperadorAtivoDto,
  DashboardProblemasDto,
  DashboardRankingClienteDto,
  DashboardSlaDto,
  DashboardSnapshotDto,
} from './dto/dashboard-response.dto';

const FILA_LIMIT = 50;
const ESTADIA_CRITICA_HORAS = 72;
const OPERACAO_HORAS = 24;

function round2(n: number | null | undefined): number | null {
  if (n === null || n === undefined || Number.isNaN(n)) return null;
  return Math.round(n * 100) / 100;
}

function startEndOfToday(): { ini: Date; fim: Date } {
  const ini = new Date();
  ini.setHours(0, 0, 0, 0);
  const fim = new Date();
  fim.setHours(23, 59, 59, 999);
  return { ini, fim };
}

function resolveKpisPeriodo(periodo: DashboardKpisPeriodo): {
  ini: Date;
  fim: Date;
  prevIni: Date;
  prevFim: Date;
} {
  const fim = new Date();
  fim.setHours(23, 59, 59, 999);
  const ini = new Date();
  ini.setHours(0, 0, 0, 0);

  if (periodo === 'semana') {
    ini.setDate(fim.getDate() - 6);
    const prevFim = new Date(ini);
    prevFim.setMilliseconds(-1);
    const prevIni = new Date(prevFim);
    prevIni.setDate(prevIni.getDate() - 6);
    prevIni.setHours(0, 0, 0, 0);
    return { ini, fim, prevIni, prevFim };
  }

  if (periodo === 'mes') {
    ini.setDate(1);
    const prevFim = new Date(ini);
    prevFim.setMilliseconds(-1);
    const prevIni = new Date(prevFim);
    prevIni.setDate(1);
    prevIni.setHours(0, 0, 0, 0);
    return { ini, fim, prevIni, prevFim };
  }

  const prevFim = new Date(ini);
  prevFim.setMilliseconds(-1);
  const prevIni = new Date(prevFim);
  prevIni.setHours(0, 0, 0, 0);
  return { ini, fim, prevIni, prevFim };
}

function deltaPct(current: number, previous: number): { pct: number; direction: 'up' | 'down' | 'flat' } {
  if (previous === 0 && current === 0) return { pct: 0, direction: 'flat' };
  if (previous === 0) return { pct: 100, direction: 'up' };
  const pct = Math.round(((current - previous) / previous) * 1000) / 10;
  if (Math.abs(pct) < 0.1) return { pct: 0, direction: 'flat' };
  return { pct, direction: pct > 0 ? 'up' : 'down' };
}

function teuFromTamanho(tamanho: string | null | undefined): number {
  const m = (tamanho ?? '').match(/(\d{2})/);
  if (!m) return 1;
  return parseInt(m[1], 10) >= 40 ? 2 : 1;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private resolvePeriodo(query: DashboardQueryDto): { ini: Date; fim: Date } {
    if (query.dataInicio && query.dataFim) {
      return parseRelatorioInicioFim(query.dataInicio, query.dataFim);
    }
    const fim = new Date();
    const ini = new Date(fim);
    ini.setDate(ini.getDate() - 7);
    ini.setHours(0, 0, 0, 0);
    fim.setHours(23, 59, 59, 999);
    return { ini, fim };
  }

  /** Filtro base em solicitações ativas + opcionais (sem alterar regras de domínio). */
  private baseSolWhere(query: DashboardQueryDto): Prisma.SolicitacaoWhereInput {
    const w: Prisma.SolicitacaoWhereInput = { deletedAt: null };
    if (query.clienteId) w.clienteId = query.clienteId;
    if (query.status) w.status = query.status;
    return w;
  }

  private podeVerFinanceiro(actor: AuthUser): boolean {
    return actor.role === Role.ADMIN || actor.role === Role.GERENTE;
  }

  /** KPIs executivos para cockpit — TAT, TEU, pátio, frota, séries para gráficos. */
  async calculateKpis(periodo: DashboardKpisPeriodo = 'hoje'): Promise<DashboardKpisDto> {
    const { ini, fim, prevIni, prevFim } = resolveKpisPeriodo(periodo);
    const [current, previous, yardTypes, financeBars] = await Promise.all([
      this.kpisSnapshot(ini, fim),
      this.kpisSnapshot(prevIni, prevFim),
      this.yardByContainerType(),
      this.revenueVsFleetBars(ini, fim),
    ]);

    return {
      periodo,
      tat: current.tat,
      yardOccupancy: current.yardOccupancy,
      fleetEfficiency: current.fleetEfficiency,
      revenuePerTeu: current.revenuePerTeu,
      dailyRevenue: current.revenue,
      tatDelta: deltaPct(current.tat, previous.tat),
      yardDelta: deltaPct(current.yardOccupancy, previous.yardOccupancy),
      fleetDelta: deltaPct(current.fleetEfficiency, previous.fleetEfficiency),
      revenueDelta: deltaPct(current.revenue, previous.revenue),
      tatHistory: current.tatHistory,
      revenueVsFleetCost: financeBars,
      yardByContainerType: yardTypes,
      geradoEm: new Date().toISOString(),
    };
  }

  private async kpisSnapshot(
    ini: Date,
    fim: Date,
  ): Promise<{
    tat: number;
    yardOccupancy: number;
    fleetEfficiency: number;
    revenue: number;
    revenuePerTeu: number;
    tatHistory: { hour: string; tat: number }[];
  }> {
    const [tatRow, historyRows, ocupados, capAgg, motoristas, fatSum, teuRows, slaFallback] =
      await Promise.all([
        this.prisma.$queryRaw<Array<{ m: number | null }>>`
          SELECT AVG(EXTRACT(EPOCH FROM (co."data_hora" - ci."data_hora")) / 60.0) AS m
          FROM gate_v2_check_outs co
          INNER JOIN gate_v2_check_ins ci ON ci.id = co.gate_in_id
          WHERE co."data_hora" >= ${ini} AND co."data_hora" <= ${fim}
        `,
        this.prisma.$queryRaw<Array<{ hr: number; tat: number | null }>>`
          SELECT EXTRACT(HOUR FROM ci."data_hora")::int AS hr,
                 AVG(EXTRACT(EPOCH FROM (co."data_hora" - ci."data_hora")) / 60.0) AS tat
          FROM gate_v2_check_outs co
          INNER JOIN gate_v2_check_ins ci ON ci.id = co.gate_in_id
          WHERE ci."data_hora" >= ${ini} AND ci."data_hora" <= ${fim}
          GROUP BY hr
          ORDER BY hr
        `,
        this.prisma.patioUnidade.count(),
        this.prisma.patioPosicao.aggregate({ _sum: { capacidade: true } }),
        this.prisma.motorista.groupBy({ by: ['status'], _count: true }),
        this.prisma.faturamentoItem.aggregate({
          where: { createdAt: { gte: ini, lte: fim } },
          _sum: { valor: true },
        }),
        this.prisma.$queryRaw<Array<{ tamanho: string | null }>>`
          SELECT cs.tamanho
          FROM gate_v2_check_outs co
          INNER JOIN gate_v2_check_ins ci ON ci.id = co.gate_in_id
          INNER JOIN containers_solicitacao cs ON cs."solicitacaoId" = ci."solicitacaoId"
          WHERE co."data_hora" >= ${ini} AND co."data_hora" <= ${fim}
        `,
        this.prisma.$queryRaw<Array<{ m: number | null }>>`
          SELECT AVG(EXTRACT(EPOCH FROM (g."createdAt" - pt."createdAt")) / 60.0) AS m
          FROM gates g
          INNER JOIN portarias pt ON pt."solicitacaoId" = g."solicitacaoId"
          INNER JOIN solicitacoes s ON s.id = g."solicitacaoId"
          WHERE s."deletedAt" IS NULL AND g."createdAt" >= ${ini} AND g."createdAt" <= ${fim}
        `,
      ]);

    let tat = round2(tatRow[0]?.m ?? null) ?? 0;
    if (tat <= 0) {
      tat = round2(slaFallback[0]?.m ?? null) ?? 0;
    }

    const capacidade = capAgg._sum.capacidade ?? 0;
    const yardOccupancy =
      capacidade > 0 ? Math.min(100, Math.round((ocupados / capacidade) * 100)) : 0;

    const emViagem = motoristas.find((m) => m.status === 'EM_VIAGEM')?._count ?? 0;
    const frotaAtiva =
      (motoristas.find((m) => m.status === 'DISPONIVEL')?._count ?? 0) + emViagem;
    const fleetEfficiency = frotaAtiva > 0 ? Math.round((emViagem / frotaAtiva) * 100) : 0;

    const revenue = Number(fatSum._sum.valor?.toFixed(2) ?? 0);
    const totalTeu = teuRows.reduce((s, r) => s + teuFromTamanho(r.tamanho), 0) || 1;
    const revenuePerTeu = round2(revenue / totalTeu) ?? 0;

    const byHour = new Map<number, number>();
    for (const row of historyRows) {
      byHour.set(row.hr, round2(row.tat ?? null) ?? 0);
    }
    const tatHistory: { hour: string; tat: number }[] = [];
    for (let h = 0; h < 24; h += 1) {
      tatHistory.push({
        hour: `${String(h).padStart(2, '0')}h`,
        tat: byHour.get(h) ?? 0,
      });
    }

    return { tat, yardOccupancy, fleetEfficiency, revenue, revenuePerTeu, tatHistory };
  }

  private async yardByContainerType(): Promise<
    { tipo: string; quantidade: number; pct: number }[]
  > {
    const rows = await this.prisma.patioUnidade.findMany({
      select: {
        unidadeIso: true,
        refrigerado: true,
        solicitacao: {
          select: {
            containersSolicitacao: {
              select: { unidade: true, status: true },
            },
          },
        },
      },
    });

    const counts = { CHEIO: 0, VAZIO: 0, REEFER: 0 };
    for (const pu of rows) {
      const iso = pu.unidadeIso.replace(/\s/g, '').toUpperCase();
      const cs = pu.solicitacao.containersSolicitacao.find(
        (c) => c.unidade.replace(/\s/g, '').toUpperCase() === iso,
      );
      if (pu.refrigerado) counts.REEFER += 1;
      else if (cs?.status === 'VAZIO') counts.VAZIO += 1;
      else counts.CHEIO += 1;
    }

    const total = counts.CHEIO + counts.VAZIO + counts.REEFER;
    if (!total) {
      return [
        { tipo: 'CHEIO', quantidade: 0, pct: 0 },
        { tipo: 'VAZIO', quantidade: 0, pct: 0 },
        { tipo: 'REEFER', quantidade: 0, pct: 0 },
      ];
    }

    return (['CHEIO', 'VAZIO', 'REEFER'] as const).map((tipo) => ({
      tipo,
      quantidade: counts[tipo],
      pct: Math.round((counts[tipo] / total) * 1000) / 10,
    }));
  }

  private async revenueVsFleetBars(
    ini: Date,
    fim: Date,
  ): Promise<{ label: string; receita: number; custoFrota: number }[]> {
    const [receitaRows, frotaRows] = await Promise.all([
      this.prisma.$queryRaw<Array<{ d: Date; total: number | null }>>`
        SELECT date_trunc('day', fi."createdAt")::date AS d,
               SUM(fi.valor)::float AS total
        FROM faturamento_itens fi
        WHERE fi."createdAt" >= ${ini} AND fi."createdAt" <= ${fim}
        GROUP BY 1
        ORDER BY 1
      `,
      this.prisma.$queryRaw<Array<{ d: Date; total: number | null }>>`
        SELECT date_trunc('day', a."createdAt")::date AS d,
               SUM(COALESCE(a.valor_frete, 0))::float AS total
        FROM agendamentos_terminal a
        WHERE a."createdAt" >= ${ini} AND a."createdAt" <= ${fim}
          AND a.modalidade_transporte = 'FROTA_FL'
        GROUP BY 1
        ORDER BY 1
      `,
    ]);

    const recMap = new Map(receitaRows.map((r) => [r.d.toISOString().slice(0, 10), Number(r.total ?? 0)]));
    const frotaMap = new Map(frotaRows.map((r) => [r.d.toISOString().slice(0, 10), Number(r.total ?? 0)]));

    const labels = new Set([...recMap.keys(), ...frotaMap.keys()]);
    return [...labels]
      .sort()
      .slice(-14)
      .map((label) => ({
        label: label.slice(5),
        receita: round2(recMap.get(label) ?? 0) ?? 0,
        custoFrota: round2(frotaMap.get(label) ?? 0) ?? 0,
      }));
  }

  async getDashboard(query: DashboardQueryDto, actor: AuthUser): Promise<DashboardOperacionalResponseDto> {
    const periodo = this.resolvePeriodo(query);
    const baseWhere = this.baseSolWhere(query);
    const incluirFinanceiro = this.podeVerFinanceiro(actor);

    const [
      snapshot,
      sla,
      conflitos,
      filas,
      clientes,
    ] = await Promise.all([
      this.buildSnapshot(baseWhere, query),
      this.buildSla(baseWhere, periodo, incluirFinanceiro),
      this.buildConflitos(baseWhere),
      this.buildFilas(baseWhere),
      incluirFinanceiro ? this.buildClientes(query) : Promise.resolve(null),
    ]);

    return {
      geradoEm: new Date().toISOString(),
      periodoAplicado: {
        dataInicio: periodo.ini.toISOString().slice(0, 10),
        dataFim: periodo.fim.toISOString().slice(0, 10),
      },
      snapshot,
      sla,
      conflitos,
      filas,
      clientes,
    };
  }

  private async buildSnapshot(
    baseWhere: Prisma.SolicitacaoWhereInput,
    _query: DashboardQueryDto,
  ): Promise<DashboardSnapshotDto> {
    const patioSemSaidaWhere: Prisma.SolicitacaoWhereInput = {
      ...baseWhere,
      patio: { isNot: null },
      saida: null,
    };

    const [unidadesNoPatio, unidadesEmPortaria, unidadesEmGate, unidadesEmSaidaPendente, hoje] =
      await Promise.all([
        this.prisma.unidade.count({
          where: { solicitacao: patioSemSaidaWhere },
        }),
        this.prisma.solicitacao.count({
          where: {
            ...baseWhere,
            portaria: { isNot: null },
            gate: null,
          },
        }),
        this.prisma.solicitacao.count({
          where: {
            ...baseWhere,
            gate: { isNot: null },
            patio: null,
          },
        }),
        this.prisma.solicitacao.count({
          where: patioSemSaidaWhere,
        }),
        Promise.resolve(startEndOfToday()),
      ]);

    const unidadesConcluidasHoje = await this.prisma.saida.count({
      where: {
        dataHoraSaida: { gte: hoje.ini, lte: hoje.fim },
        solicitacao: baseWhere,
      },
    });

    const [gatesSemPortaria, saidasSemGateOuPatio, isoDupRows, statusInconsistentes] =
      await Promise.all([
        this.prisma.gate.count({
          where: {
            solicitacao: {
              ...baseWhere,
              portaria: null,
            },
          },
        }),
        this.prisma.saida.count({
          where: {
            solicitacao: {
              ...baseWhere,
              OR: [{ gate: null }, { patio: null }],
            },
          },
        }),
        this.isoDuplicadosEmSolicitacoesAtivas(),
        this.prisma.solicitacao.count({
          where: {
            ...baseWhere,
            status: StatusSolicitacao.CONCLUIDO,
            saida: null,
          },
        }),
      ]);

    const isoDup = isoDupRows.length;

    const problemas: DashboardProblemasDto = {
      total: gatesSemPortaria + saidasSemGateOuPatio + isoDup + statusInconsistentes,
      isoDuplicadoEmSolicitacoesAtivas: isoDup,
      gatesSemPortaria,
      saidasSemGateOuPatio,
      statusInconsistentes,
    };

    return {
      unidadesNoPatio,
      unidadesEmPortaria,
      unidadesEmGate,
      unidadesEmSaidaPendente,
      unidadesConcluidasHoje,
      unidadesComProblemas: problemas,
    };
  }

  /** Mesmo ISO em mais de uma solicitação ativa (anomalia; schema normalmente impede duplicata global). */
  private async isoDuplicadosEmSolicitacoesAtivas(): Promise<Array<{ numeroIso: string; c: bigint }>> {
    return this.prisma.$queryRaw<Array<{ numeroIso: string; c: bigint }>>`
      SELECT u."numeroIso" as "numeroIso", COUNT(*)::bigint AS c
      FROM unidades_solicitacao u
      INNER JOIN solicitacoes s ON s.id = u."solicitacaoId"
      WHERE s."deletedAt" IS NULL
      GROUP BY u."numeroIso"
      HAVING COUNT(*) > 1
    `;
  }

  private async buildSla(
    baseWhere: Prisma.SolicitacaoWhereInput,
    periodo: { ini: Date; fim: Date },
    incluirRanking: boolean,
  ): Promise<DashboardSlaDto> {
    const clienteFilter = baseWhere.clienteId
      ? Prisma.sql`AND s."clienteId" = ${baseWhere.clienteId as string}`
      : Prisma.empty;

    const statusFilter =
      baseWhere.status !== undefined
        ? Prisma.sql`AND s.status = ${baseWhere.status as StatusSolicitacao}`
        : Prisma.empty;

    /** Amostras cuja transição da etapa ocorreu no período (createdAt do registro da etapa destino). */
    const filtroPeriodoGate = Prisma.sql`
      AND g."createdAt" >= ${periodo.ini}
      AND g."createdAt" <= ${periodo.fim}
    `;
    const filtroPeriodoPatio = Prisma.sql`
      AND ptio."createdAt" >= ${periodo.ini}
      AND ptio."createdAt" <= ${periodo.fim}
    `;
    const filtroPeriodoSaida = Prisma.sql`
      AND sa."createdAt" >= ${periodo.ini}
      AND sa."createdAt" <= ${periodo.fim}
    `;

    const [pg, gp, ps, estadia, critica, ranking] = await Promise.all([
      this.prisma.$queryRaw<Array<{ m: number | null }>>`
        SELECT AVG(EXTRACT(EPOCH FROM (g."createdAt" - pt."createdAt")) / 60.0) AS m
        FROM gates g
        INNER JOIN portarias pt ON pt."solicitacaoId" = g."solicitacaoId"
        INNER JOIN solicitacoes s ON s.id = g."solicitacaoId"
        WHERE s."deletedAt" IS NULL ${filtroPeriodoGate} ${clienteFilter} ${statusFilter}
      `,
      this.prisma.$queryRaw<Array<{ m: number | null }>>`
        SELECT AVG(EXTRACT(EPOCH FROM (ptio."createdAt" - g."createdAt")) / 60.0) AS m
        FROM patios ptio
        INNER JOIN gates g ON g."solicitacaoId" = ptio."solicitacaoId"
        INNER JOIN solicitacoes s ON s.id = g."solicitacaoId"
        WHERE s."deletedAt" IS NULL ${filtroPeriodoPatio} ${clienteFilter} ${statusFilter}
      `,
      this.prisma.$queryRaw<Array<{ m: number | null }>>`
        SELECT AVG(EXTRACT(EPOCH FROM (sa."dataHoraSaida" - ptio."createdAt")) / 60.0) AS m
        FROM saidas sa
        INNER JOIN patios ptio ON ptio."solicitacaoId" = sa."solicitacaoId"
        INNER JOIN solicitacoes s ON s.id = sa."solicitacaoId"
        WHERE s."deletedAt" IS NULL ${filtroPeriodoSaida} ${clienteFilter} ${statusFilter}
      `,
      this.prisma.$queryRaw<Array<{ m: number | null }>>`
        SELECT AVG(EXTRACT(EPOCH FROM (NOW() - ptio."createdAt")) / 3600.0) AS m
        FROM patios ptio
        INNER JOIN solicitacoes s ON s.id = ptio."solicitacaoId"
        LEFT JOIN saidas sa ON sa."solicitacaoId" = s.id
        WHERE s."deletedAt" IS NULL AND sa.id IS NULL ${clienteFilter} ${statusFilter}
      `,
      this.prisma.solicitacao.count({
        where: {
          ...baseWhere,
          saida: null,
          patio: {
            createdAt: {
              lt: new Date(Date.now() - ESTADIA_CRITICA_HORAS * 3600 * 1000),
            },
          },
        },
      }),
      incluirRanking ? this.rankingClientes(periodo, baseWhere.clienteId as string | undefined) : [],
    ]);

    const sla: DashboardSlaDto = {
      tempoMedioPortariaGate: round2(pg[0]?.m ?? null),
      tempoMedioGatePatio: round2(gp[0]?.m ?? null),
      tempoMedioPatioSaida: round2(ps[0]?.m ?? null),
      idadeMediaEstadiaHoras: round2(estadia[0]?.m ?? null),
      unidadesComEstadiaCritica: critica,
      rankingClientesPorVolume: incluirRanking ? ranking : undefined,
    };

    return sla;
  }

  private async rankingClientes(
    periodo: { ini: Date; fim: Date },
    clienteId?: string,
  ): Promise<DashboardRankingClienteDto[]> {
    const clienteFilter = clienteId ? Prisma.sql`AND s."clienteId" = ${clienteId}` : Prisma.empty;
    const rows = await this.prisma.$queryRaw<
      Array<{ clienteId: string; nome: string; volume: bigint }>
    >`
      SELECT s."clienteId", c.nome, COUNT(s.id)::bigint AS volume
      FROM solicitacoes s
      INNER JOIN clientes c ON c.id = s."clienteId"
      WHERE s."deletedAt" IS NULL
        AND c."deletedAt" IS NULL
        AND s."createdAt" >= ${periodo.ini}
        AND s."createdAt" <= ${periodo.fim}
        ${clienteFilter}
      GROUP BY s."clienteId", c.nome
      ORDER BY volume DESC
      LIMIT 10
    `;
    return rows.map((r) => ({
      clienteId: r.clienteId,
      clienteNome: r.nome,
      solicitacoesNoPeriodo: Number(r.volume),
    }));
  }

  private async buildConflitos(baseWhere: Prisma.SolicitacaoWhereInput): Promise<DashboardConflitosDto> {
    const [gatesSemPortaria, saidasSemGateOuPatio, isoDup, tentativas] = await Promise.all([
      this.prisma.gate.count({
        where: {
          solicitacao: {
            ...baseWhere,
            portaria: null,
          },
        },
      }),
      this.prisma.saida.count({
        where: {
          solicitacao: {
            ...baseWhere,
            OR: [{ gate: null }, { patio: null }],
          },
        },
      }),
      this.isoDuplicadosEmSolicitacoesAtivas(),
      this.prisma.auditoria.count({
        where: {
          acao: AcaoAuditoria.SEGURANCA,
          tabela: 'escopo_cliente',
        },
      }),
    ]);

    return {
      conflitosDePosicao: 0,
      gatesSemPortaria,
      saidasSemGateOuPatio,
      unidadesComISORepetido: isoDup.length,
      tentativas403PorEscopo: tentativas,
    };
  }

  private async buildFilas(baseWhere: Prisma.SolicitacaoWhereInput): Promise<DashboardFilasDto> {
    const [filaPortaria, filaGate, filaPatioSaida, operadores] = await Promise.all([
      this.carregarFila(
        {
          ...baseWhere,
          portaria: { isNot: null },
          gate: null,
        },
        'portaria',
      ),
      this.carregarFila(
        {
          ...baseWhere,
          gate: { isNot: null },
          patio: null,
        },
        'gate',
      ),
      this.carregarFila(
        {
          ...baseWhere,
          patio: { isNot: null },
          saida: null,
        },
        'patio',
      ),
      this.operadoresAtivos(),
    ]);

    return {
      filaPortaria,
      filaGate,
      filaPatio: filaPatioSaida,
      filaSaida: filaPatioSaida,
      operacoesAtivasPorOperador: operadores,
    };
  }

  private async carregarFila(
    where: Prisma.SolicitacaoWhereInput,
    ordenacao: 'portaria' | 'gate' | 'patio',
  ): Promise<DashboardFilaItemDto[]> {
    const orderBy =
      ordenacao === 'portaria'
        ? { portaria: { createdAt: 'asc' as const } }
        : ordenacao === 'gate'
          ? { gate: { createdAt: 'asc' as const } }
          : { patio: { createdAt: 'asc' as const } };

    const rows = await this.prisma.solicitacao.findMany({
      where,
      include: {
        cliente: true,
        portaria: true,
        gate: true,
        patio: true,
        unidades: true,
      },
      orderBy,
      take: FILA_LIMIT,
    });

    return rows.map((s) => {
      const ordenadoPor =
        ordenacao === 'portaria'
          ? s.portaria!.createdAt.toISOString()
          : ordenacao === 'gate'
            ? s.gate!.createdAt.toISOString()
            : s.patio!.createdAt.toISOString();

      const item: DashboardFilaItemDto = {
        solicitacaoId: s.id,
        protocolo: s.protocolo,
        clienteId: s.clienteId,
        clienteNome: s.cliente.razaoSocial,
        ordenadoPor,
        quantidadeUnidades: s.unidades.length,
      };
      if (ordenacao === 'patio' && s.patio) {
        item.quadra = s.patio.quadra;
        item.fileira = s.patio.fileira;
        item.posicao = s.patio.posicao;
      }
      return item;
    });
  }

  private async operadoresAtivos(): Promise<DashboardOperadorAtivoDto[]> {
    const since = new Date(Date.now() - OPERACAO_HORAS * 3600 * 1000);
    const grp = await this.prisma.auditoria.groupBy({
      by: ['usuario'],
      where: {
        createdAt: { gte: since },
        tabela: { in: ['portarias', 'gates', 'patios', 'saidas'] },
        acao: { in: [AcaoAuditoria.INSERT, AcaoAuditoria.UPDATE] },
      },
      _count: { _all: true },
    });

    grp.sort((a, b) => b._count._all - a._count._all);

    const ids = grp.map((g) => g.usuario);
    const users =
      ids.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: ids } },
            select: { id: true, email: true },
          })
        : [];
    const emailById = new Map(users.map((u) => [u.id, u.email]));

    return grp.map(
      (g): DashboardOperadorAtivoDto => ({
        usuarioId: g.usuario,
        email: emailById.get(g.usuario) ?? null,
        operacoes24h: g._count._all,
      }),
    );
  }

  private async buildClientes(query: DashboardQueryDto): Promise<DashboardClientesDto> {
    const clienteFilter = query.clienteId
      ? Prisma.sql`AND s."clienteId" = ${query.clienteId}`
      : Prisma.empty;

    const unidadesPorCliente = await this.prisma.$queryRaw<
      Array<{ clienteId: string; nome: string; totalUnidades: bigint }>
    >`
      SELECT c.id AS "clienteId", c.nome, COUNT(u.id)::bigint AS "totalUnidades"
      FROM clientes c
      INNER JOIN solicitacoes s ON s."clienteId" = c.id AND s."deletedAt" IS NULL
      INNER JOIN unidades_solicitacao u ON u."solicitacaoId" = s.id
      WHERE c."deletedAt" IS NULL ${clienteFilter}
      GROUP BY c.id, c.nome
      ORDER BY "totalUnidades" DESC
    `;

    const fatPend = await this.prisma.$queryRaw<
      Array<{ clienteId: string; nome: string; solicitacoesElegiveis: bigint }>
    >`
      SELECT s."clienteId", c.nome, COUNT(DISTINCT s.id)::bigint AS "solicitacoesElegiveis"
      FROM solicitacoes s
      INNER JOIN clientes c ON c.id = s."clienteId"
      INNER JOIN saidas sa ON sa."solicitacaoId" = s.id
      WHERE s."deletedAt" IS NULL AND c."deletedAt" IS NULL ${clienteFilter}
        AND NOT EXISTS (
          SELECT 1 FROM faturamento_solicitacoes fs WHERE fs."solicitacaoId" = s.id
        )
      GROUP BY s."clienteId", c.nome
    `;

    const portalPend = await this.prisma.$queryRaw<
      Array<{ clienteId: string; nome: string; solicitacoesPendentesAprovacao: bigint }>
    >`
      SELECT s."clienteId", c.nome, COUNT(*)::bigint AS "solicitacoesPendentesAprovacao"
      FROM solicitacoes s
      INNER JOIN clientes c ON c.id = s."clienteId"
      WHERE s."deletedAt" IS NULL AND c."deletedAt" IS NULL
        AND s.status = ${StatusSolicitacao.PENDENTE}
        ${clienteFilter}
      GROUP BY s."clienteId", c.nome
    `;

    return {
      unidadesPorCliente: unidadesPorCliente.map((r) => ({
        clienteId: r.clienteId,
        clienteNome: r.nome,
        totalUnidades: Number(r.totalUnidades),
      })),
      faturamentoPendentePorCliente: fatPend.map((r) => ({
        clienteId: r.clienteId,
        clienteNome: r.nome,
        solicitacoesElegiveis: Number(r.solicitacoesElegiveis),
      })),
      unidadesComSolicitacaoAprovacaoNoPortal: portalPend.map((r) => ({
        clienteId: r.clienteId,
        clienteNome: r.nome,
        solicitacoesPendentesAprovacao: Number(r.solicitacoesPendentesAprovacao),
      })),
    };
  }
}
