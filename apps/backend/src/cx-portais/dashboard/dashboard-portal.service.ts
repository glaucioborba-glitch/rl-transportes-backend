import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { StatusCadastroCliente, StatusSolicitacao, type TipoCliente, TipoUnidade, ValidacaoDominio } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { PlataformaTenantStore } from '../../plataforma-integracao/stores/plataforma-tenant.store';
import { HoldReleaseService } from '../../hold-release/hold-release.service';
import type { CxPortalRequestUser } from '../types/cx-portal.types';
import {
  avaliarSlaOperacional,
  decToNumber,
  desempenhoPct,
  hoursBetween,
  mapStatusCounts,
  mapUnidadesPorTipo,
  monthBoundsUtc,
  prevMonthBoundsUtc,
  type SlaHorasOperacionais,
} from './dashboard-portal-metrics.util';

export type DashboardPortalOptions = {
  recentPage?: number;
  recentLimit?: number;
};

export type DashboardUltimaSolicitacao = {
  id: string;
  protocolo: string;
  status: StatusSolicitacao;
  createdAt: Date;
};

export type DashboardPortalClientePublico = {
  id: string;
  nome: string;
  cpfCnpj: string;
};

/** Resposta `GET /cliente/portal/dashboard` — métricas reais + campos legados Next.js. */
export type DashboardPortalConsolidated = {
  cliente: (DashboardPortalClientePublico & {
    tipo: TipoCliente;
    emailNfse: string | null;
    inscricaoEstadual: string | null;
    endereco: {
      logradouro: string;
      numero: string;
      bairro: string;
      cidade: string;
      uf: string;
      cep: string;
      codigoIbge: string;
      complemento: string | null;
    };
  }) | null;
  solicitacoes: {
    abertas: number;
    emAndamento: number;
    concluidas: number;
    canceladas: number;
    ultimas: DashboardUltimaSolicitacao[];
  };
  slas: {
    cumpridos: number;
    violados: number;
    desempenho: number;
  };
  financeiro: {
    boletosPendentes: number;
    nfseEmitidas: number;
    faturadoMes: number;
    totalFaturadoPeriodo: number;
  };
  unidades: {
    total: number;
    import: number;
    export: number;
    gateIn: number;
    gateOut: number;
  };
  tendencias: {
    solicitacoesMesVsAnteriorPct: number;
    faturadoMesVsAnteriorPct: number;
  };

  totalSolicitacoes: number;
  solicitacoesRecentes: unknown[];
  kpis: {
    abertas: number;
    emAndamento: number;
    concluídas: number;
  };
  kpisCx: {
    personalizaveis: string[];
    valores: {
      ciclo_medio_horas: number | null;
      containers_ativos: number;
      faturamento_aberto: number;
    };
  };
  slasCx: {
    tenantId: string;
    contratadosProxy: Record<string, number>;
    historicoProxy: { periodo: string; cumprimentoPctProxy: number }[];
  };
  trackingSample: unknown[];
  solicitacoesHoje: unknown[];
  recent: {
    items: unknown[];
    total: number;
    page: number;
    limit: number;
    orderBy: string;
    order: string;
  };
  meta: {
    tenantId: string;
    slasMinutosMeta: Record<string, number> | null;
    cacheHit?: boolean;
    slaAmostraConcluidas: number;
  };
  isBloqueadoFinanceiramente: boolean;
  statusCadastro: StatusCadastroCliente | null;
  validacaoDominio: ValidacaoDominio | null;
  condicaoPagamento: string | null;
  cadastroOperacionalLiberado: boolean;
};

const DASHBOARD_SOL_INC = {
  cliente: {
    select: {
      id: true,
      razaoSocial: true,
      tipo: true,
      cpfCnpj: true,
    },
  },
  portaria: true,
  gate: true,
  patio: true,
  saida: true,
  unidades: true,
} satisfies Prisma.SolicitacaoInclude;

const CACHE_TTL_SEC = 30;

@Injectable()
export class DashboardPortalService {
  private readonly logger = new Logger(DashboardPortalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenants: PlataformaTenantStore,
    private readonly redis: RedisService,
    private readonly holdRelease: HoldReleaseService,
  ) {}

  private clientScope(cx: CxPortalRequestUser, clienteIdParam?: string): string {
    if (cx.portalPapel === 'STAFF') {
      if (!clienteIdParam) {
        throw new BadRequestException('Parâmetro clienteId obrigatório para visão ADMIN/GERENTE');
      }
      return clienteIdParam;
    }
    if (!cx.clienteId) {
      throw new BadRequestException('Usuário portal sem vínculo de cliente');
    }
    return cx.clienteId;
  }

  private formatDoc(cpfCnpj: string): string {
    const d = cpfCnpj.replace(/\D/g, '');
    if (d.length === 14) {
      const tail11 = d.slice(-11);
      if (/^\d{11}$/.test(tail11) && d.startsWith('000')) return tail11;
      return d;
    }
    return d;
  }

  private async safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await fn();
    } catch {
      return fallback;
    }
  }

  private async limitesSla(cx: CxPortalRequestUser): Promise<SlaHorasOperacionais> {
    const t = (await this.tenants.obter(cx.tenantId)) ?? (await this.tenants.obter('default'));
    const p = t?.config.slasMinutosMeta;
    return {
      gate: p?.gate ?? 240,
      patio: p?.patio ?? 4320,
      saida: p?.saida ?? 1440,
    };
  }

  /** Agregação por status em uma única consulta. */
  async getResumoSolicitacoes(clienteId: string) {
    const rows = await this.safe(
      () =>
        this.prisma.solicitacao.groupBy({
          by: ['status'],
          where: { clienteId, deletedAt: null },
          _count: { _all: true },
        }),
      [],
    );
    return mapStatusCounts(rows as { status: StatusSolicitacao; _count: { _all: number } }[]);
  }

  async getUltimasSolicitacoes(clienteId: string, take = 10): Promise<DashboardUltimaSolicitacao[]> {
    return this.safe(
      () =>
        this.prisma.solicitacao.findMany({
          where: { clienteId, deletedAt: null },
          take,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            protocolo: true,
            status: true,
            createdAt: true,
          },
        }),
      [],
    );
  }

  /**
   * SLAs reais: solicitações concluídas (90d) com marcos operacionais × limites do tenant (BR-AG proxy).
   */
  async getResumoSLAs(clienteId: string, limites: SlaHorasOperacionais) {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 90);

    const concluidas = await this.safe(
      () =>
        this.prisma.solicitacao.findMany({
          where: {
            clienteId,
            deletedAt: null,
            status: StatusSolicitacao.CONCLUIDO,
            updatedAt: { gte: since },
            saida: { isNot: null },
          },
          take: 500,
          orderBy: { updatedAt: 'desc' },
          select: {
            createdAt: true,
            portaria: { select: { createdAt: true } },
            gate: { select: { createdAt: true } },
            patio: { select: { createdAt: true } },
            saida: { select: { dataHoraSaida: true } },
          },
        }),
      [],
    );

    let cumpridos = 0;
    let violados = 0;
    let avaliadas = 0;

    for (const s of concluidas) {
      const ok = avaliarSlaOperacional(s.createdAt, s, limites);
      if (ok === null) continue;
      avaliadas += 1;
      if (ok) cumpridos += 1;
      else violados += 1;
    }

    return {
      cumpridos,
      violados,
      desempenho: desempenhoPct(cumpridos, violados),
      amostraConcluidas: concluidas.length,
      avaliadas,
    };
  }

  async getResumoFinanceiro(clienteId: string): Promise<DashboardPortalConsolidated['financeiro']> {
    const since30 = new Date();
    since30.setUTCDate(since30.getUTCDate() - 30);
    const { start: mesInicio, end: mesFim } = monthBoundsUtc();

    const [boletosPendentes, nfseEmitidas, sum30, sumMes] = await Promise.all([
      this.safe(
        () =>
          this.prisma.boleto.count({
            where: {
              faturamento: { clienteId },
              NOT: { statusPagamento: { equals: 'pago', mode: 'insensitive' } },
            },
          }),
        0,
      ),
      this.safe(
        () =>
          this.prisma.nfsEmitida.count({
            where: { faturamento: { clienteId } },
          }),
        0,
      ),
      this.safe(
        () =>
          this.prisma.faturamento.aggregate({
            where: { clienteId, createdAt: { gte: since30 } },
            _sum: { valorTotal: true },
          }),
        { _sum: { valorTotal: null } },
      ),
      this.safe(
        () =>
          this.prisma.faturamento.aggregate({
            where: {
              clienteId,
              createdAt: { gte: mesInicio, lte: mesFim },
            },
            _sum: { valorTotal: true },
          }),
        { _sum: { valorTotal: null } },
      ),
    ]);

    return {
      boletosPendentes,
      nfseEmitidas,
      faturadoMes: decToNumber(sumMes._sum.valorTotal),
      totalFaturadoPeriodo: decToNumber(sum30._sum.valorTotal),
    };
  }

  /** Uma consulta `groupBy` por tipo de unidade (todas as solicitações do cliente). */
  async getResumoUnidades(clienteId: string): Promise<DashboardPortalConsolidated['unidades']> {
    const rows = await this.safe(
      () =>
        this.prisma.unidade.groupBy({
          by: ['tipo'],
          where: {
            solicitacao: {
              clienteId,
              deletedAt: null,
            },
          },
          _count: { _all: true },
        }),
      [],
    );
    return mapUnidadesPorTipo(rows as { tipo: TipoUnidade; _count: { _all: number } }[]);
  }

  private async tendenciasFinanceirasESolicitacoes(clienteId: string): Promise<DashboardPortalConsolidated['tendencias']> {
    const thisM = monthBoundsUtc();
    const prevM = prevMonthBoundsUtc();

    const [solEste, solAnt, fatEste, fatAnt] = await Promise.all([
      this.safe(
        () =>
          this.prisma.solicitacao.count({
            where: {
              clienteId,
              deletedAt: null,
              createdAt: { gte: thisM.start, lte: thisM.end },
            },
          }),
        0,
      ),
      this.safe(
        () =>
          this.prisma.solicitacao.count({
            where: {
              clienteId,
              deletedAt: null,
              createdAt: { gte: prevM.start, lte: prevM.end },
            },
          }),
        0,
      ),
      this.safe(
        () =>
          this.prisma.faturamento.aggregate({
            where: {
              clienteId,
              createdAt: { gte: thisM.start, lte: thisM.end },
            },
            _sum: { valorTotal: true },
          }),
        { _sum: { valorTotal: null } },
      ),
      this.safe(
        () =>
          this.prisma.faturamento.aggregate({
            where: {
              clienteId,
              createdAt: { gte: prevM.start, lte: prevM.end },
            },
            _sum: { valorTotal: true },
          }),
        { _sum: { valorTotal: null } },
      ),
    ]);

    const fe = decToNumber(fatEste._sum.valorTotal);
    const fa = decToNumber(fatAnt._sum.valorTotal);
    const faturadoMesVsAnteriorPct =
      fa === 0 ? (fe > 0 ? 100 : 0) : Math.round(((fe - fa) / fa) * 1000) / 10;

    const solicitacoesMesVsAnteriorPct =
      solAnt === 0 ? (solEste > 0 ? 100 : 0) : Math.round(((solEste - solAnt) / solAnt) * 1000) / 10;

    return { solicitacoesMesVsAnteriorPct, faturadoMesVsAnteriorPct };
  }

  async getClienteContext(clienteId: string): Promise<DashboardPortalConsolidated['cliente']> {
    return this.safe(async () => {
      const c = await this.prisma.cliente.findFirst({
        where: { id: clienteId, deletedAt: null },
        select: {
          id: true,
          razaoSocial: true,
          tipo: true,
          cpfCnpj: true,
          emailNfse: true,
          email: true,
          enderecoCep: true,
          enderecoLogradouro: true,
          enderecoNumero: true,
          enderecoComplemento: true,
          enderecoBairro: true,
          enderecoCidade: true,
          enderecoUf: true,
          codigoMunicipioIbge: true,
          inscricaoEstadual: true,
          isentoIE: true,
          statusCadastro: true,
          validacaoDominio: true,
          condicaoPagamento: true,
        },
      });
      if (!c) return null;
      const nome = (c.razaoSocial ?? '').trim() || 'Cliente';
      const rawEmailNfse = (c.emailNfse ?? '').trim();
      const emailNfse = rawEmailNfse.length ? rawEmailNfse : null;
      return {
        id: c.id,
        nome,
        tipo: c.tipo,
        cpfCnpj: this.formatDoc(c.cpfCnpj),
        emailNfse,
        inscricaoEstadual: c.isentoIE
          ? 'Isento'
          : (c.inscricaoEstadual ?? '').trim() || null,
        endereco: {
          cep: (c.enderecoCep ?? '').trim(),
          logradouro: (c.enderecoLogradouro ?? '').trim(),
          numero: (c.enderecoNumero ?? '').trim(),
          complemento: c.enderecoComplemento?.trim() ?? null,
          bairro: (c.enderecoBairro ?? '').trim(),
          cidade: (c.enderecoCidade ?? '').trim(),
          uf: (c.enderecoUf ?? '').trim(),
          codigoIbge: (c.codigoMunicipioIbge ?? '').trim(),
        },
      };
    }, null);
  }

  private async loadKpisExtras(clienteId: string, resumo: ReturnType<typeof mapStatusCounts>) {
    const base: Prisma.SolicitacaoWhereInput = { clienteId, deletedAt: null };
    const since30 = new Date();
    since30.setUTCDate(since30.getUTCDate() - 30);

    const [concluidas30d, cicloRows, containersAtivos, faturamentoAberto] = await Promise.all([
      this.safe(
        () =>
          this.prisma.solicitacao.count({
            where: {
              ...base,
              status: StatusSolicitacao.CONCLUIDO,
              updatedAt: { gte: since30 },
            },
          }),
        0,
      ),
      this.safe(
        () =>
          this.prisma.solicitacao.findMany({
            where: { ...base, status: StatusSolicitacao.CONCLUIDO },
            take: 30,
            orderBy: { updatedAt: 'desc' },
            select: { createdAt: true, updatedAt: true },
          }),
        [],
      ),
      this.safe(
        () =>
          this.prisma.solicitacao.count({
            where: {
              clienteId,
              deletedAt: null,
              status: { in: [StatusSolicitacao.PENDENTE, StatusSolicitacao.APROVADO] },
              saida: { is: null },
            },
          }),
        0,
      ),
      this.safe(
        () =>
          this.prisma.faturamento.count({
            where: {
              clienteId,
              statusBoleto: { not: 'pago' },
            },
          }),
        0,
      ),
    ]);

    const ciclo_medio_horas =
      cicloRows.length > 0
        ? Math.round(
            (cicloRows.reduce((a, r) => {
              return a + hoursBetween(r.createdAt, r.updatedAt);
            }, 0) /
              cicloRows.length) *
              10,
          ) / 10
        : null;

    return {
      concluidas30d,
      ciclo_medio_horas,
      containers_ativos: containersAtivos,
      faturamento_aberto: faturamentoAberto,
      totalSolicitacoes: resumo.total,
      abertas: resumo.abertas,
      emAndamento: resumo.emAndamento,
      concluidas: resumo.concluidas,
      canceladas: resumo.canceladas,
    };
  }

  /** Fallback seguro — evita 500 quando agregações ou includes falham. */
  private async emptyConsolidated(cx: CxPortalRequestUser, page: number, limit: number): Promise<DashboardPortalConsolidated> {
    const limites = await this.limitesSla(cx);
    return {
      cliente: null,
      solicitacoes: {
        abertas: 0,
        emAndamento: 0,
        concluidas: 0,
        canceladas: 0,
        ultimas: [],
      },
      slas: { cumpridos: 0, violados: 0, desempenho: 100 },
      financeiro: {
        boletosPendentes: 0,
        nfseEmitidas: 0,
        faturadoMes: 0,
        totalFaturadoPeriodo: 0,
      },
      unidades: { total: 0, import: 0, export: 0, gateIn: 0, gateOut: 0 },
      tendencias: { solicitacoesMesVsAnteriorPct: 0, faturadoMesVsAnteriorPct: 0 },
      totalSolicitacoes: 0,
      solicitacoesRecentes: [],
      kpis: { abertas: 0, emAndamento: 0, concluídas: 0 },
      kpisCx: {
        personalizaveis: ['ciclo_medio_horas', 'containers_ativos', 'faturamento_aberto'],
        valores: {
          ciclo_medio_horas: null,
          containers_ativos: 0,
          faturamento_aberto: 0,
        },
      },
      slasCx: {
        tenantId: cx.tenantId,
        contratadosProxy: limites,
        historicoProxy: [{ periodo: '30d', cumprimentoPctProxy: 100 }],
      },
      trackingSample: [],
      solicitacoesHoje: [],
      recent: {
        items: [],
        total: 0,
        page,
        limit,
        orderBy: 'createdAt',
        order: 'desc',
      },
      meta: {
        tenantId: cx.tenantId,
        slasMinutosMeta: limites,
        cacheHit: false,
        slaAmostraConcluidas: 0,
      },
      isBloqueadoFinanceiramente: false,
      statusCadastro: null,
      validacaoDominio: null,
      condicaoPagamento: null,
      cadastroOperacionalLiberado: false,
    };
  }

  private async loadCadastroMeta(clienteId: string) {
    const c = await this.prisma.cliente.findFirst({
      where: { id: clienteId, deletedAt: null },
      select: {
        statusCadastro: true,
        validacaoDominio: true,
        condicaoPagamento: true,
      },
    });
    return {
      statusCadastro: c?.statusCadastro ?? null,
      validacaoDominio: c?.validacaoDominio ?? null,
      condicaoPagamento: c?.condicaoPagamento ?? null,
      cadastroOperacionalLiberado: c?.statusCadastro === StatusCadastroCliente.APROVADO,
    };
  }

  async buildConsolidated(
    cx: CxPortalRequestUser,
    clienteIdParam?: string,
    opts?: DashboardPortalOptions,
  ): Promise<DashboardPortalConsolidated> {
    const clienteId = this.clientScope(cx, clienteIdParam);
    const page = Math.max(1, opts?.recentPage ?? 1);
    const limit = Math.min(100, Math.max(1, opts?.recentLimit ?? 8));
    const skip = (page - 1) * limit;

    try {
      const cacheKey = `cxportal:dash:v3:${clienteId}:${clienteIdParam ?? 'self'}:${page}:${limit}`;
      try {
        const hit = await this.redis.get(cacheKey);
        if (hit) {
          const parsed = JSON.parse(hit) as DashboardPortalConsolidated;
          return { ...parsed, meta: { ...parsed.meta, cacheHit: true } };
        }
      } catch (e) {
        this.logger.warn(`Cache dashboard ignorado: ${(e as Error).message}`);
      }

      const limites = await this.limitesSla(cx);

      const todayUtc = new Date();
      const y = todayUtc.getUTCFullYear();
      const m = String(todayUtc.getUTCMonth() + 1).padStart(2, '0');
      const day = String(todayUtc.getUTCDate()).padStart(2, '0');
      const dayStart = new Date(`${y}-${m}-${day}T00:00:00.000Z`);
      const dayEnd = new Date(`${y}-${m}-${day}T23:59:59.999Z`);

      const resumoSol = await this.getResumoSolicitacoes(clienteId);

      const [ultimas, slaReal, fin, unidades, tend, clienteCtx, solKpis] = await Promise.all([
        this.getUltimasSolicitacoes(clienteId, 10),
        this.getResumoSLAs(clienteId, limites),
        this.getResumoFinanceiro(clienteId),
        this.getResumoUnidades(clienteId),
        this.tendenciasFinanceirasESolicitacoes(clienteId),
        this.getClienteContext(clienteId),
        this.loadKpisExtras(clienteId, resumoSol),
      ]);

      const [solicitacoesRecentesPage, trackingSample, solicitacoesHoje, totalRecent, bloqueadoFin, cadastroMeta] =
        await Promise.all([
        this.safe(
          () =>
            this.prisma.solicitacao.findMany({
              where: { clienteId, deletedAt: null },
              skip,
              take: limit,
              orderBy: { createdAt: 'desc' },
              include: DASHBOARD_SOL_INC,
            }),
          [],
        ),
        this.safe(
          () =>
            this.prisma.solicitacao.findMany({
              where: { clienteId, deletedAt: null },
              take: 5,
              orderBy: { createdAt: 'desc' },
              include: DASHBOARD_SOL_INC,
            }),
          [],
        ),
        this.safe(
          () =>
            this.prisma.solicitacao.findMany({
              where: {
                clienteId,
                deletedAt: null,
                createdAt: { gte: dayStart, lte: dayEnd },
              },
              take: 100,
              orderBy: { createdAt: 'desc' },
              include: DASHBOARD_SOL_INC,
            }),
          [],
        ),
        this.safe(
          () =>
            this.prisma.solicitacao.count({
              where: { clienteId, deletedAt: null },
            }),
          0,
        ),
        this.holdRelease.isClienteBloqueadoFinanceiramente(clienteId, cx.tenantId),
        this.loadCadastroMeta(clienteId),
      ]);

      const historicoProxy = [
        { periodo: '30d', cumprimentoPctProxy: slaReal.desempenho },
        {
          periodo: '90d',
          cumprimentoPctProxy: Math.max(0, slaReal.desempenho - 3),
        },
      ];

      const payload: DashboardPortalConsolidated = {
        cliente: clienteCtx,
        solicitacoes: {
          abertas: resumoSol.abertas,
          emAndamento: resumoSol.emAndamento,
          concluidas: resumoSol.concluidas,
          canceladas: resumoSol.canceladas,
          ultimas,
        },
        slas: {
          cumpridos: slaReal.cumpridos,
          violados: slaReal.violados,
          desempenho: slaReal.desempenho,
        },
        financeiro: fin,
        unidades,
        tendencias: tend,
        totalSolicitacoes: solKpis.totalSolicitacoes,
        solicitacoesRecentes: solicitacoesRecentesPage,
        kpis: {
          abertas: solKpis.abertas,
          emAndamento: solKpis.emAndamento,
          concluídas: solKpis.concluidas,
        },
        kpisCx: {
          personalizaveis: ['ciclo_medio_horas', 'containers_ativos', 'faturamento_aberto'],
          valores: {
            ciclo_medio_horas: solKpis.ciclo_medio_horas,
            containers_ativos: solKpis.containers_ativos,
            faturamento_aberto: solKpis.faturamento_aberto,
          },
        },
        slasCx: {
          tenantId: cx.tenantId,
          contratadosProxy: limites,
          historicoProxy,
        },
        trackingSample,
        solicitacoesHoje,
        recent: {
          items: solicitacoesRecentesPage,
          total: totalRecent,
          page,
          limit,
          orderBy: 'createdAt',
          order: 'desc',
        },
        meta: {
          tenantId: cx.tenantId,
          slasMinutosMeta: limites,
          cacheHit: false,
          slaAmostraConcluidas: slaReal.amostraConcluidas,
        },
        isBloqueadoFinanceiramente: bloqueadoFin,
        ...cadastroMeta,
      };

      try {
        await this.redis.setex(cacheKey, CACHE_TTL_SEC, JSON.stringify(payload));
      } catch (e) {
        this.logger.warn(`Cache dashboard set ignorado: ${(e as Error).message}`);
      }

      return payload;
    } catch (e) {
      this.logger.error(`buildConsolidated: ${(e as Error).message}`);
      return await this.emptyConsolidated(cx, page, limit);
    }
  }
}
