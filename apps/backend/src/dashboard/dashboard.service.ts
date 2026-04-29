import { Injectable } from '@nestjs/common';
import { AcaoAuditoria, Prisma, Role, StatusSolicitacao } from '@prisma/client';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { parseRelatorioInicioFim } from '../common/utils/relatorio-periodo';
import { PrismaService } from '../prisma/prisma.service';
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
        clienteNome: s.cliente.nome,
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
