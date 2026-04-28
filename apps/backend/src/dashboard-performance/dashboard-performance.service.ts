import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AcaoAuditoria, Prisma, Role } from '@prisma/client';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { parseRelatorioInicioFim } from '../common/utils/relatorio-periodo';
import { PrismaService } from '../prisma/prisma.service';
import type { DashboardPerformanceQueryDto } from './dto/dashboard-performance-query.dto';
import type {
  DashboardPerformanceEstrategicosDto,
  DashboardPerformanceGargalosDto,
  DashboardPerformanceHeatDto,
  DashboardPerformanceMargemClienteItemDto,
  DashboardPerformanceMargemCustoDto,
  DashboardPerformanceMargemTipoDto,
  DashboardPerformanceMesValorDto,
  DashboardPerformanceOpDto,
  DashboardPerformanceProdHumanaDto,
  DashboardPerformanceResponseDto,
  DashboardPerformanceSeriesDto,
  DashboardPerformanceSerieClienteMesDto,
  DashboardPerformanceTurnoDto,
} from './dto/dashboard-performance-response.dto';

const OP_TABLES = ['portarias', 'gates', 'patios', 'saidas'] as const;

function round2(n: number | null | undefined): number | null {
  if (n === null || n === undefined || Number.isNaN(n)) return null;
  return Math.round(n * 10000) / 10000;
}

function num(d: Prisma.Decimal | bigint | null | undefined): number {
  if (d === null || d === undefined) return 0;
  if (typeof d === 'bigint') return Number(d);
  return Number(d.toFixed(2));
}

@Injectable()
export class DashboardPerformanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private custoMinutoProxy(): number {
    const v = parseFloat(this.config.get<string>('PERFORMANCE_CUSTO_MINUTO_PROXY') ?? '0.05');
    return Number.isFinite(v) && v >= 0 ? v : 0.05;
  }

  private limiteFilaGargalo(): number {
    const v = parseInt(this.config.get<string>('PERFORMANCE_FILA_GARGALO_LIMITE') ?? '15', 10);
    return Number.isFinite(v) && v > 0 ? v : 15;
  }

  private capacidadePatioEstimada(): number {
    const v = parseInt(
      this.config.get<string>('PERFORMANCE_PATIO_CAPACIDADE_ESTIMADA') ?? '200',
      10,
    );
    return Number.isFinite(v) && v > 0 ? v : 200;
  }

  private resolvePeriodo(query: DashboardPerformanceQueryDto): { ini: Date; fim: Date } {
    if (query.dataInicio && query.dataFim) {
      return parseRelatorioInicioFim(query.dataInicio, query.dataFim);
    }
    const fim = new Date();
    const ini = new Date(fim);
    ini.setDate(ini.getDate() - 30);
    ini.setHours(0, 0, 0, 0);
    fim.setHours(23, 59, 59, 999);
    return { ini, fim };
  }

  private baseSol(clienteId?: string): Prisma.SolicitacaoWhereInput {
    return {
      deletedAt: null,
      ...(clienteId ? { clienteId } : {}),
    };
  }

  private gestao(actor: AuthUser): boolean {
    return actor.role === Role.ADMIN || actor.role === Role.GERENTE;
  }

  async getPerformance(
    query: DashboardPerformanceQueryDto,
    actor: AuthUser,
  ): Promise<DashboardPerformanceResponseDto> {
    const { ini, fim } = this.resolvePeriodo(query);
    const clienteId = query.clienteId;
    const base = this.baseSol(clienteId);
    const horasPeriodo = Math.max(1 / 60, (fim.getTime() - ini.getTime()) / 3_600_000);

    const custoMin = this.custoMinutoProxy();
    const limFila = this.limiteFilaGargalo();
    const capPatio = this.capacidadePatioEstimada();

    const [
      throughputPortaria,
      throughputGate,
      throughputPatio,
      cicloHoras,
      filaPortaria,
      filaGate,
      filaPatio,
      retrabalhoRatioVal,
      violGate,
      violSaida,
      isoDup,
      queuePortariaInst,
      queueGateInst,
      queuePatioInst,
    ] = await Promise.all([
      this.prisma.portaria.count({
        where: {
          createdAt: { gte: ini, lte: fim },
          solicitacao: base,
        },
      }),
      this.prisma.gate.count({
        where: {
          createdAt: { gte: ini, lte: fim },
          solicitacao: base,
        },
      }),
      this.prisma.patio.count({
        where: {
          createdAt: { gte: ini, lte: fim },
          solicitacao: base,
        },
      }),
      this.cicloCompletoHoras(ini, fim, clienteId),
      this.tempoMedioFilaHoras('portaria', ini, fim, clienteId),
      this.tempoMedioFilaHoras('gate', ini, fim, clienteId),
      this.tempoMedioFilaHoras('patio', ini, fim, clienteId),
      this.retrabalhoRatio(ini, fim),
      this.prisma.gate.count({
        where: { solicitacao: { ...base, portaria: null } },
      }),
      this.prisma.saida.count({
        where: {
          solicitacao: {
            ...base,
            OR: [{ gate: null }, { patio: null }],
          },
        },
      }),
      this.isoDuplicados(),
      this.prisma.solicitacao.count({
        where: { ...base, portaria: { isNot: null }, gate: null },
      }),
      this.prisma.solicitacao.count({
        where: { ...base, gate: { isNot: null }, patio: null },
      }),
      this.prisma.solicitacao.count({
        where: { ...base, patio: { isNot: null }, saida: null },
      }),
    ]);

    const custoMedioPorOp =
      cicloHoras !== null ? round2(cicloHoras * 60 * custoMin) : null;

    const ocupacaoPatio = await this.ocupacaoPatioPercent(base, capPatio);

    const taxaGargalo =
      queuePortariaInst >= limFila ||
      queueGateInst >= limFila ||
      queuePatioInst >= limFila;

    const margemCliente = this.gestao(actor)
      ? await this.margemPorClienteLista(ini, fim, clienteId)
      : null;

    const [prodOps, turnos, heat] = await Promise.all([
      this.produtividadeOperadores(),
      this.produtividadeTurno(ini, fim),
      this.mapaCalor7d(),
    ]);

    const margemCustoDto = this.gestao(actor)
      ? await this.buildMargemCusto(ini, fim, clienteId, custoMin, cicloHoras)
      : null;

    const series = await this.buildSeries(
      custoMin,
      cicloHoras,
      clienteId,
      this.gestao(actor),
    );

    const estrategicos: DashboardPerformanceEstrategicosDto = {
      custoMedioPorOperacao: custoMedioPorOp,
      margemOperacionalPorCliente: margemCliente,
      throughputPortaria: round2(throughputPortaria / horasPeriodo),
      throughputGate: round2(throughputGate / horasPeriodo),
      throughputPatio: round2(throughputPatio / horasPeriodo),
      tempoMedioDeCicloCompletoHoras: cicloHoras,
      ocupacaoPatioPercent: ocupacaoPatio,
      taxaRetrabalho: retrabalhoRatioVal,
      taxaGargaloDetectado: taxaGargalo,
    };

    const prodHumana: DashboardPerformanceProdHumanaDto = {
      produtividadePorOperador: prodOps,
      produtividadePorTurno: turnos,
      mapaCalorPorHora: heat,
    };

    const topRetrabalho = [...prodOps].sort((a, b) => (b.proporcaoUpdates ?? 0) - (a.proporcaoUpdates ?? 0)).slice(0, 8);

    const gargalos: DashboardPerformanceGargalosDto = {
      tempoMedioEmFilaPortariaHoras: filaPortaria,
      tempoMedioEmFilaGateHoras: filaGate,
      tempoMedioEmFilaPatioHoras: filaPatio,
      violacoesGateSemPortaria: violGate,
      violacoesSaidaSemCompleto: violSaida,
      conflitosPosicaoPatio: 0,
      isoDuplicado: isoDup.length,
      operadoresComMaisRetrabalho: topRetrabalho,
    };

    const full: DashboardPerformanceResponseDto = {
      estrategicos,
      produtividadeHumana: prodHumana,
      margemCusto: margemCustoDto,
      gargalos,
      series,
      periodoAplicado: {
        dataInicio: ini.toISOString().slice(0, 10),
        dataFim: fim.toISOString().slice(0, 10),
      },
      geradoEm: new Date().toISOString(),
      parametrosProxy: {
        custoMinutoProxy: custoMin,
        limiteFilaGargalo: limFila,
        capacidadePatioEstimada: capPatio,
      },
    };

    return this.applyVisaoOperador(actor, full);
  }

  /** Operadores: throughput + própria produtividade; sem blocos financeiros nem ranking de pares. */
  private applyVisaoOperador(
    actor: AuthUser,
    full: DashboardPerformanceResponseDto,
  ): DashboardPerformanceResponseDto {
    if (actor.role === Role.ADMIN || actor.role === Role.GERENTE) {
      return full;
    }

    const selfOps = full.produtividadeHumana.produtividadePorOperador.filter(
      (p) => p.usuarioId === actor.sub,
    );

    return {
      ...full,
      estrategicos: {
        ...full.estrategicos,
        custoMedioPorOperacao: null,
        margemOperacionalPorCliente: null,
        tempoMedioDeCicloCompletoHoras: null,
        ocupacaoPatioPercent: null,
        taxaRetrabalho: null,
      },
      produtividadeHumana: {
        ...full.produtividadeHumana,
        produtividadePorOperador: selfOps,
      },
      margemCusto: null,
      gargalos: {
        ...full.gargalos,
        operadoresComMaisRetrabalho: [],
      },
      series: {
        produtividadeDiaria30d: full.series.produtividadeDiaria30d,
        margemMensal12m: null,
        custoMedioMensal12m: null,
      },
    };
  }

  private async cicloCompletoHoras(
    ini: Date,
    fim: Date,
    clienteId?: string,
  ): Promise<number | null> {
    const cf = clienteId ? Prisma.sql`AND s."clienteId" = ${clienteId}` : Prisma.empty;
    const rows = await this.prisma.$queryRaw<Array<{ m: number | null }>>`
      SELECT AVG(EXTRACT(EPOCH FROM (sa."dataHoraSaida" - po."createdAt")) / 3600.0) AS m
      FROM solicitacoes s
      JOIN portarias po ON po."solicitacaoId" = s.id
      JOIN gates g ON g."solicitacaoId" = s.id
      JOIN patios pt ON pt."solicitacaoId" = s.id
      JOIN saidas sa ON sa."solicitacaoId" = s.id
      WHERE s."deletedAt" IS NULL
        AND po."createdAt" >= ${ini}
        AND sa."dataHoraSaida" <= ${fim}
        ${cf}
    `;
    return rows[0]?.m !== null && rows[0]?.m !== undefined ? round2(rows[0].m) : null;
  }

  /** Tempo médio entre registros consecutivos da cadeia (proxy fila). */
  private async tempoMedioFilaHoras(
    etapa: 'portaria' | 'gate' | 'patio',
    ini: Date,
    fim: Date,
    clienteId?: string,
  ): Promise<number | null> {
    const cf = clienteId ? Prisma.sql`AND s."clienteId" = ${clienteId}` : Prisma.empty;
    const sql =
      etapa === 'portaria'
        ? Prisma.sql`
          SELECT AVG(EXTRACT(EPOCH FROM (g."createdAt" - po."createdAt")) / 3600.0) AS m
          FROM solicitacoes s
          JOIN portarias po ON po."solicitacaoId" = s.id
          JOIN gates g ON g."solicitacaoId" = s.id
          WHERE s."deletedAt" IS NULL AND po."createdAt" >= ${ini} AND g."createdAt" <= ${fim} ${cf}
        `
        : etapa === 'gate'
          ? Prisma.sql`
          SELECT AVG(EXTRACT(EPOCH FROM (pt."createdAt" - g."createdAt")) / 3600.0) AS m
          FROM solicitacoes s
          JOIN gates g ON g."solicitacaoId" = s.id
          JOIN patios pt ON pt."solicitacaoId" = s.id
          WHERE s."deletedAt" IS NULL AND g."createdAt" >= ${ini} AND pt."createdAt" <= ${fim} ${cf}
        `
          : Prisma.sql`
          SELECT AVG(EXTRACT(EPOCH FROM (sa."dataHoraSaida" - pt."createdAt")) / 3600.0) AS m
          FROM solicitacoes s
          JOIN patios pt ON pt."solicitacaoId" = s.id
          JOIN saidas sa ON sa."solicitacaoId" = s.id
          WHERE s."deletedAt" IS NULL AND pt."createdAt" >= ${ini} AND sa."dataHoraSaida" <= ${fim} ${cf}
        `;
    const rows = await this.prisma.$queryRaw<Array<{ m: number | null }>>(sql);
    return rows[0]?.m !== null && rows[0]?.m !== undefined ? round2(rows[0].m) : null;
  }

  private async retrabalhoRatio(ini: Date, fim: Date): Promise<number | null> {
    const rows = await this.prisma.auditoria.groupBy({
      by: ['acao'],
      where: {
        createdAt: { gte: ini, lte: fim },
        tabela: { in: [...OP_TABLES] },
        acao: { in: [AcaoAuditoria.INSERT, AcaoAuditoria.UPDATE] },
      },
      _count: { id: true },
    });
    let ins = 0;
    let upd = 0;
    for (const r of rows) {
      if (r.acao === AcaoAuditoria.INSERT) ins += r._count.id;
      if (r.acao === AcaoAuditoria.UPDATE) upd += r._count.id;
    }
    const tot = ins + upd;
    return tot > 0 ? round2(upd / tot) : null;
  }

  private async ocupacaoPatioPercent(
    base: Prisma.SolicitacaoWhereInput,
    cap: number,
  ): Promise<number | null> {
    const ocupados = await this.prisma.solicitacao.count({
      where: {
        ...base,
        patio: { isNot: null },
        saida: null,
      },
    });
    return round2(Math.min(100, (ocupados / cap) * 100));
  }

  private async margemPorClienteLista(
    ini: Date,
    fim: Date,
    clienteId?: string,
  ): Promise<DashboardPerformanceMargemClienteItemDto[]> {
    const cfSol = clienteId ? Prisma.sql`AND s."clienteId" = ${clienteId}` : Prisma.empty;
    const rows = await this.prisma.$queryRaw<
      Array<{ clienteId: string; nome: string; receita: unknown; unidades: bigint }>
    >`
      WITH receita AS (
        SELECT f."clienteId" AS cid, SUM(f."valorTotal")::numeric AS receita
        FROM faturamentos f
        WHERE f."createdAt" >= ${ini} AND f."createdAt" <= ${fim}
        ${clienteId ? Prisma.sql`AND f."clienteId" = ${clienteId}` : Prisma.empty}
        GROUP BY f."clienteId"
      ),
      unidades AS (
        SELECT s."clienteId" AS cid, COUNT(u.id)::bigint AS unidades
        FROM solicitacoes s
        INNER JOIN saidas sa ON sa."solicitacaoId" = s.id
          AND sa."dataHoraSaida" >= ${ini} AND sa."dataHoraSaida" <= ${fim}
        INNER JOIN unidades_solicitacao u ON u."solicitacaoId" = s.id
        WHERE s."deletedAt" IS NULL
        ${cfSol}
        GROUP BY s."clienteId"
      )
      SELECT c.id AS "clienteId", c.nome,
             COALESCE(r.receita, 0)::numeric AS receita,
             COALESCE(u.unidades, 0)::bigint AS unidades
      FROM clientes c
      INNER JOIN receita r ON r.cid = c.id
      LEFT JOIN unidades u ON u.cid = c.id
      WHERE c."deletedAt" IS NULL
      ORDER BY receita DESC
      LIMIT 15
    `;

    return rows.map((r) => {
      const rec = num(r.receita as Prisma.Decimal);
      const un = Number(r.unidades);
      return {
        clienteId: r.clienteId,
        clienteNome: r.nome,
        receitaPeriodo: round2(rec) ?? 0,
        unidadesConcluidas: un,
        proxyMargemPorUnidade: un > 0 ? round2(rec / un) : null,
      };
    });
  }

  private async buildMargemCusto(
    ini: Date,
    fim: Date,
    clienteId: string | undefined,
    custoMin: number,
    cicloHoras: number | null,
  ): Promise<DashboardPerformanceMargemCustoDto> {
    const fs = await this.prisma.faturamento.aggregate({
      where: {
        createdAt: { gte: ini, lte: fim },
        ...(clienteId ? { clienteId } : {}),
      },
      _sum: { valorTotal: true },
    });
    const units = await this.prisma.unidade.count({
      where: {
        solicitacao: {
          deletedAt: null,
          ...(clienteId ? { clienteId } : {}),
          saida: {
            dataHoraSaida: { gte: ini, lte: fim },
          },
        },
      },
    });
    const total = num(fs._sum.valorTotal);
    const proxyMargem = units > 0 ? round2(total / units) : null;

    const opsEstimadas = await this.prisma.auditoria.count({
      where: {
        createdAt: { gte: ini, lte: fim },
        tabela: { in: [...OP_TABLES] },
        acao: AcaoAuditoria.INSERT,
      },
    });
    const custoEst =
      cicloHoras !== null
        ? round2(opsEstimadas * cicloHoras * 60 * custoMin)
        : round2(opsEstimadas * 60 * custoMin);

    const margemPorTipo = await this.margemPorTipoUnidades(ini, fim, clienteId);

    const serie = await this.margemClienteSerie6Meses(clienteId);

    return {
      proxyMargem,
      custoOperacionalEstimado: custoEst,
      margemPorTipo,
      margemPorClienteSerie6Meses: serie,
    };
  }

  private async margemPorTipoUnidades(
    ini: Date,
    fim: Date,
    clienteId?: string,
  ): Promise<DashboardPerformanceMargemTipoDto[]> {
    const fs = await this.prisma.faturamento.aggregate({
      where: {
        createdAt: { gte: ini, lte: fim },
        ...(clienteId ? { clienteId } : {}),
      },
      _sum: { valorTotal: true },
    });
    const receitaPeriodo = num(fs._sum.valorTotal);
    const rows = await this.prisma.unidade.groupBy({
      by: ['tipo'],
      where: {
        solicitacao: {
          deletedAt: null,
          ...(clienteId ? { clienteId } : {}),
          saida: {
            dataHoraSaida: { gte: ini, lte: fim },
          },
        },
      },
      _count: { id: true },
    });
    const totalUn = rows.reduce((a, r) => a + r._count.id, 0);
    const proxyGlobal =
      totalUn > 0 && receitaPeriodo > 0 ? round2(receitaPeriodo / totalUn) : null;
    return rows.map((r) => ({
      tipo: r.tipo as unknown as string,
      unidades: r._count.id,
      proxyMargemUnitaria: proxyGlobal,
    }));
  }

  private async margemClienteSerie6Meses(
    clienteId?: string,
  ): Promise<DashboardPerformanceSerieClienteMesDto[]> {
    const now = new Date();
    const ini = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const cf = clienteId ? Prisma.sql`AND f."clienteId" = ${clienteId}` : Prisma.empty;
    const rows = await this.prisma.$queryRaw<
      Array<{ clienteId: string; nome: string; mes: string; valor: unknown }>
    >`
      SELECT f."clienteId", c.nome, f.periodo AS mes,
             SUM(f."valorTotal")::numeric AS valor
      FROM faturamentos f
      INNER JOIN clientes c ON c.id = f."clienteId"
      WHERE c."deletedAt" IS NULL
        AND f.periodo >= ${`${ini.getFullYear()}-${String(ini.getMonth() + 1).padStart(2, '0')}`}
      ${cf}
      GROUP BY f."clienteId", c.nome, f.periodo
      ORDER BY mes DESC, valor DESC
      LIMIT 120
    `;
    return rows.map((r) => ({
      clienteId: r.clienteId,
      clienteNome: r.nome,
      mes: r.mes,
      valorFaturado: round2(num(r.valor as Prisma.Decimal)) ?? 0,
    }));
  }

  private async produtividadeOperadores(): Promise<DashboardPerformanceOpDto[]> {
    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const grp = await this.prisma.auditoria.groupBy({
      by: ['usuario', 'acao'],
      where: {
        createdAt: { gte: since },
        tabela: { in: [...OP_TABLES] },
        acao: { in: [AcaoAuditoria.INSERT, AcaoAuditoria.UPDATE] },
      },
      _count: { id: true },
    });
    const totPorUser = new Map<string, { ins: number; upd: number }>();
    for (const r of grp) {
      const cur = totPorUser.get(r.usuario) ?? { ins: 0, upd: 0 };
      if (r.acao === AcaoAuditoria.INSERT) cur.ins += r._count.id;
      if (r.acao === AcaoAuditoria.UPDATE) cur.upd += r._count.id;
      totPorUser.set(r.usuario, cur);
    }
    const ids = [...totPorUser.keys()];
    const users =
      ids.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: ids } },
            select: { id: true, email: true },
          })
        : [];
    const em = new Map(users.map((u) => [u.id, u.email]));
    return ids.map((id) => {
      const { ins, upd } = totPorUser.get(id)!;
      const tot = ins + upd;
      return {
        usuarioId: id,
        email: em.get(id) ?? null,
        operacoes24h: tot,
        proporcaoUpdates: tot > 0 ? round2(upd / tot) : null,
      };
    });
  }

  private async produtividadeTurno(ini: Date, fim: Date): Promise<DashboardPerformanceTurnoDto> {
    const rows = await this.prisma.$queryRaw<Array<{ turno: string; c: bigint }>>`
      SELECT t.turno, SUM(t.c)::bigint AS c
      FROM (
        SELECT CASE
          WHEN EXTRACT(HOUR FROM a."createdAt") >= 6 AND EXTRACT(HOUR FROM a."createdAt") < 12 THEN 'manha'
          WHEN EXTRACT(HOUR FROM a."createdAt") >= 12 AND EXTRACT(HOUR FROM a."createdAt") < 18 THEN 'tarde'
          ELSE 'noite'
        END AS turno,
        1 AS c
        FROM auditorias a
        WHERE a."createdAt" >= ${ini}
          AND a."createdAt" <= ${fim}
          AND a.tabela IN ('portarias','gates','patios','saidas')
          AND a.acao IN ('INSERT','UPDATE')
      ) t
      GROUP BY t.turno
    `;
    const dto: DashboardPerformanceTurnoDto = { manha: 0, tarde: 0, noite: 0 };
    for (const r of rows) {
      const n = Number(r.c);
      if (r.turno === 'manha') dto.manha = n;
      else if (r.turno === 'tarde') dto.tarde = n;
      else dto.noite = n;
    }
    return dto;
  }

  private async mapaCalor7d(): Promise<DashboardPerformanceHeatDto[]> {
    const ini = new Date();
    ini.setDate(ini.getDate() - 7);
    const rows = await this.prisma.$queryRaw<Array<{ h: number; c: bigint }>>`
      SELECT EXTRACT(HOUR FROM a."createdAt")::int AS h, COUNT(*)::bigint AS c
      FROM auditorias a
      WHERE a."createdAt" >= ${ini}
        AND a.tabela IN ('portarias','gates','patios','saidas')
        AND a.acao IN ('INSERT','UPDATE')
      GROUP BY h
      ORDER BY h
    `;
    const out: DashboardPerformanceHeatDto[] = [];
    for (let h = 0; h < 24; h++) {
      const row = rows.find((x) => x.h === h);
      out.push({ hora: h, total: row ? Number(row.c) : 0 });
    }
    return out;
  }

  private async buildSeries(
    custoMin: number,
    cicloHoras: number | null,
    clienteId: string | undefined,
    gestao: boolean,
  ): Promise<DashboardPerformanceSeriesDto> {
    const ini30 = new Date();
    ini30.setDate(ini30.getDate() - 30);
    const daily = await this.prisma.$queryRaw<Array<{ d: Date; c: bigint }>>`
      SELECT date_trunc('day', a."createdAt")::date AS d, COUNT(*)::bigint AS c
      FROM auditorias a
      WHERE a."createdAt" >= ${ini30}
        AND a.tabela IN ('portarias','gates','patios','saidas')
        AND a.acao IN ('INSERT','UPDATE')
      GROUP BY date_trunc('day', a."createdAt")
      ORDER BY d
    `;

    const produtividadeDiaria30d = daily.map((x) => ({
      dia: x.d.toISOString().slice(0, 10),
      operacoes: Number(x.c),
    }));

    if (!gestao) {
      return {
        produtividadeDiaria30d,
        margemMensal12m: null,
        custoMedioMensal12m: null,
      };
    }

    const ini12 = new Date();
    ini12.setMonth(ini12.getMonth() - 11);
    const y = ini12.getFullYear();
    const m = ini12.getMonth() + 1;
    const periodoMin = `${y}-${String(m).padStart(2, '0')}`;

    const margemRows = await this.prisma.$queryRaw<Array<{ mes: string; v: unknown }>>`
      SELECT f.periodo AS mes, SUM(f."valorTotal")::numeric AS v
      FROM faturamentos f
      WHERE f.periodo >= ${periodoMin}
        ${clienteId ? Prisma.sql`AND f."clienteId" = ${clienteId}` : Prisma.empty}
      GROUP BY f.periodo
      ORDER BY mes ASC
    `;

    const margemMensal12m: DashboardPerformanceMesValorDto[] = margemRows.map((r) => ({
      mes: r.mes,
      valor: round2(num(r.v as Prisma.Decimal)) ?? 0,
    }));

    const opsMonthRows = await this.prisma.$queryRaw<Array<{ mes: string; c: bigint }>>`
      SELECT to_char(date_trunc('month', a."createdAt"), 'YYYY-MM') AS mes, COUNT(*)::bigint AS c
      FROM auditorias a
      WHERE a."createdAt" >= ${ini12}
        AND a.tabela IN ('portarias','gates','patios','saidas')
        AND a.acao = 'INSERT'
      GROUP BY date_trunc('month', a."createdAt")
      ORDER BY mes ASC
    `;
    const opsPorMes = new Map(opsMonthRows.map((r) => [r.mes, Number(r.c)]));
    const ciclo = cicloHoras ?? 1;
    const custoMesFactor = ciclo * 60 * custoMin;

    const custoMedioMensal12m: DashboardPerformanceMesValorDto[] = margemMensal12m.map((row) => {
      const ops = opsPorMes.get(row.mes) ?? 0;
      return {
        mes: row.mes,
        valor: round2(ops * custoMesFactor) ?? 0,
      };
    });

    return {
      produtividadeDiaria30d,
      margemMensal12m,
      custoMedioMensal12m,
    };
  }

  private async isoDuplicados(): Promise<Array<{ numeroIso: string; c: bigint }>> {
    return this.prisma.$queryRaw`
      SELECT u."numeroIso", COUNT(*)::bigint AS c
      FROM unidades_solicitacao u
      INNER JOIN solicitacoes s ON s.id = u."solicitacaoId"
      WHERE s."deletedAt" IS NULL
      GROUP BY u."numeroIso"
      HAVING COUNT(*) > 1
    `;
  }
}
