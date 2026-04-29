import { Injectable } from '@nestjs/common';
import { Prisma, StatusPagamento, TipoCliente } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { DashboardFinanceiroQueryDto } from './dto/dashboard-financeiro-query.dto';
import type {
  DashboardFinanceiroAbcDto,
  DashboardFinanceiroAgingDto,
  DashboardFinanceiroClientesDto,
  DashboardFinanceiroDonutDto,
  DashboardFinanceiroExecutivoResponseDto,
  DashboardFinanceiroInadimplenciaDto,
  DashboardFinanceiroRankingInadimplenciaDto,
  DashboardFinanceiroReceitaDto,
  DashboardFinanceiroReceitaPorClienteDto,
  DashboardFinanceiroRentabilidadeDto,
  DashboardFinanceiroSerieTemporalDto,
  DashboardFinanceiroSnapshotDto,
} from './dto/dashboard-financeiro-response.dto';

function num(d: Prisma.Decimal | bigint | null | undefined): number {
  if (d === null || d === undefined) return 0;
  if (typeof d === 'bigint') return Number(d);
  return Number(d.toFixed(2));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Lista inclusive de competências YYYY-MM entre início e fim (lexicográfico válido para mesmo século). */
function mesesNoIntervalo(inicio: string, fim: string): string[] {
  const out: string[] = [];
  let [y, m] = inicio.split('-').map((x) => parseInt(x, 10));
  const [yf, mf] = fim.split('-').map((x) => parseInt(x, 10));
  while (y < yf || (y === yf && m <= mf)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

function mesAnterior(yyyyMm: string): string {
  const [y, mo] = yyyyMm.split('-').map((x) => parseInt(x, 10));
  const d = new Date(y, mo - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Últimos 12 meses terminando no mês atual do servidor. */
function periodoPadrao(): { periodoInicio: string; periodoFim: string } {
  const now = new Date();
  const fim = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const d = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const inicio = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return { periodoInicio: inicio, periodoFim: fim };
}

function ordenarPeriodo(a: string, b: string): number {
  return a.localeCompare(b);
}

@Injectable()
export class DashboardFinanceiroService {
  constructor(private readonly prisma: PrismaService) {}

  async getExecutivo(query: DashboardFinanceiroQueryDto): Promise<DashboardFinanceiroExecutivoResponseDto> {
    const padrao = periodoPadrao();
    let periodoInicio = query.periodoInicio ?? padrao.periodoInicio;
    let periodoFim = query.periodoFim ?? padrao.periodoFim;
    if (ordenarPeriodo(periodoInicio, periodoFim) > 0) {
      const t = periodoInicio;
      periodoInicio = periodoFim;
      periodoFim = t;
    }

    const fatWhereBase: Prisma.FaturamentoWhereInput = {
      periodo: { gte: periodoInicio, lte: periodoFim },
      ...(query.clienteId ? { clienteId: query.clienteId } : {}),
    };

    const [
      snapshot,
      receita,
      inadimplenciaBase,
      rentabilidade,
      aging,
      series,
    ] = await Promise.all([
      this.buildSnapshot(fatWhereBase, periodoFim),
      this.buildReceita(fatWhereBase),
      this.buildInadimplencia(query.clienteId),
      this.buildRentabilidade(fatWhereBase),
      this.buildAging(query.clienteId),
      this.buildSeries12(periodoFim, query.clienteId),
    ]);

    const forecastVals = this.forecastFromSeries(series);

    const inadimplenciaFull: DashboardFinanceiroInadimplenciaDto = {
      ...inadimplenciaBase,
      forecastInadimplenciaPercent: forecastVals.forecastInadPercent,
      forecastFaturamentoProximoMes: forecastVals.forecastFatNext,
    };

    const clientes = await this.buildClientesExecutivo(fatWhereBase, query.clienteId);

    return {
      snapshot,
      receita,
      inadimplencia: inadimplenciaFull,
      rentabilidade,
      aging,
      series,
      clientes,
      periodoAplicado: { periodoInicio, periodoFim },
      geradoEm: new Date().toISOString(),
    };
  }

  private async buildSnapshot(
    fatWhereBase: Prisma.FaturamentoWhereInput,
    periodoFim: string,
  ): Promise<DashboardFinanceiroSnapshotDto> {
    const [agg, itensSum, fats, distinctSol] = await Promise.all([
      this.prisma.faturamento.aggregate({
        where: fatWhereBase,
        _sum: { valorTotal: true },
        _count: true,
      }),
      this.prisma.faturamentoItem.aggregate({
        where: { faturamento: fatWhereBase },
        _sum: { valor: true },
      }),
      this.prisma.faturamento.findMany({
        where: fatWhereBase,
        select: { valorTotal: true, statusBoleto: true },
      }),
      this.prisma.faturamentoSolicitacao.findMany({
        where: { faturamento: fatWhereBase },
        distinct: ['solicitacaoId'],
        select: { solicitacaoId: true },
      }),
    ]);

    const total = num(agg._sum.valorTotal);
    const donut = this.buildDonutFromRows(fats);
    const ticket =
      distinctSol.length > 0 ? round2(total / distinctSol.length) : total > 0 ? total : null;

    const totalMesAtual = await this.somaFaturamentoMes(periodoFim, fatWhereBase);
    const mesAnt = mesAnterior(periodoFim);
    const totalMesAnt = await this.somaFaturamentoMes(mesAnt, fatWhereBase);
    const variacaoMoM =
      totalMesAnt > 0 ? round2(((totalMesAtual - totalMesAnt) / totalMesAnt) * 100) : null;

    const snapshot: DashboardFinanceiroSnapshotDto = {
      faturamentoTotalPeriodo: round2(total),
      quantidadeFaturamentos: agg._count,
      somaItensFaturamento: num(itensSum._sum.valor),
      faturamentoConcluidoVsPendente: donut,
      mediaTicketPorSolicitacao: ticket,
      variacaoMesAMesPercent: variacaoMoM,
    };

    return snapshot;
  }

  private async somaFaturamentoMes(
    mesYyyyMm: string,
    fatWhereBase: Prisma.FaturamentoWhereInput,
  ): Promise<number> {
    const r = await this.prisma.faturamento.aggregate({
      where: {
        ...fatWhereBase,
        periodo: mesYyyyMm,
      },
      _sum: { valorTotal: true },
    });
    return num(r._sum.valorTotal);
  }

  private buildDonutFromRows(
    rows: Array<{ valorTotal: Prisma.Decimal; statusBoleto: string }>,
  ): DashboardFinanceiroDonutDto {
    let concluido = 0;
    let pendente = 0;
    for (const f of rows) {
      const v = num(f.valorTotal);
      if (f.statusBoleto === StatusPagamento.PAGO) concluido += v;
      else if (f.statusBoleto !== StatusPagamento.CANCELADO) pendente += v;
    }
    const t = concluido + pendente;
    const donut: DashboardFinanceiroDonutDto = {
      concluido: round2(concluido),
      pendente: round2(pendente),
      percentual:
        t > 0
          ? {
              concluido: round2((concluido / t) * 100),
              pendente: round2((pendente / t) * 100),
            }
          : { concluido: 0, pendente: 0 },
    };
    return donut;
  }

  private async buildReceita(
    fatWhereBase: Prisma.FaturamentoWhereInput,
  ): Promise<DashboardFinanceiroReceitaDto> {
    const topRawAll = await this.prisma.faturamento.groupBy({
      by: ['clienteId'],
      where: fatWhereBase,
      _sum: { valorTotal: true },
    });
    const topRaw = topRawAll
      .sort((a, b) => num(b._sum.valorTotal) - num(a._sum.valorTotal))
      .slice(0, 10);

    const servRawAll = await this.prisma.faturamentoItem.groupBy({
      by: ['descricao'],
      where: { faturamento: fatWhereBase },
      _sum: { valor: true },
    });
    const servRaw = servRawAll
      .sort((a, b) => num(b._sum.valor) - num(a._sum.valor))
      .slice(0, 10);

    const [fats, distinctSol] = await Promise.all([
      this.prisma.faturamento.findMany({
        where: fatWhereBase,
        select: { valorTotal: true, statusBoleto: true },
      }),
      this.prisma.faturamentoSolicitacao.findMany({
        where: { faturamento: fatWhereBase },
        distinct: ['solicitacaoId'],
        select: { solicitacaoId: true },
      }),
    ]);

    const aggTotal = await this.prisma.faturamento.aggregate({
      where: fatWhereBase,
      _sum: { valorTotal: true },
    });
    const totalGeral = num(aggTotal._sum.valorTotal);

    const clienteIds = topRaw.map((r) => r.clienteId);
    const clientes =
      clienteIds.length > 0
        ? await this.prisma.cliente.findMany({
            where: { id: { in: clienteIds }, deletedAt: null },
            select: { id: true, nome: true },
          })
        : [];
    const nomePorId = new Map(clientes.map((c) => [c.id, c.nome]));

    const top10: DashboardFinanceiroReceitaPorClienteDto[] = topRaw.map((r) => {
      const v = num(r._sum.valorTotal);
      return {
        clienteId: r.clienteId,
        clienteNome: nomePorId.get(r.clienteId) ?? '(desconhecido)',
        valorTotal: round2(v),
        participacaoPercent:
          totalGeral > 0 ? round2((v / totalGeral) * 100) : 0,
      };
    });

    const porServico = servRaw.map((r) => ({
      descricaoLinha: r.descricao.trim(),
      valorTotal: round2(num(r._sum.valor)),
    }));

    const total = num(aggTotal._sum.valorTotal);
    const ticket =
      distinctSol.length > 0 ? round2(total / distinctSol.length) : total > 0 ? total : null;

    return {
      faturamentoPorClienteTop10: top10,
      faturamentoPorServico: porServico,
      mediaTicketPorSolicitacao: ticket,
      donut: this.buildDonutFromRows(fats),
    };
  }

  private async buildInadimplencia(
    clienteId?: string,
  ): Promise<Omit<DashboardFinanceiroInadimplenciaDto, 'forecastInadimplenciaPercent' | 'forecastFaturamentoProximoMes'>> {
    const bWhere: Prisma.BoletoWhereInput = {
      statusPagamento: { not: StatusPagamento.CANCELADO },
      ...(clienteId
        ? { faturamento: { clienteId } }
        : {}),
    };

    const [pendentes, vencidos, somaVenc, valorTotalBoletos, rankingRows] = await Promise.all([
      this.prisma.boleto.count({
        where: { ...bWhere, statusPagamento: StatusPagamento.PENDENTE },
      }),
      this.prisma.boleto.count({
        where: { ...bWhere, statusPagamento: StatusPagamento.VENCIDO },
      }),
      this.prisma.boleto.aggregate({
        where: { ...bWhere, statusPagamento: StatusPagamento.VENCIDO },
        _sum: { valorBoleto: true },
      }),
      this.prisma.boleto.aggregate({
        where: bWhere,
        _sum: { valorBoleto: true },
      }),
      this.prisma.boleto.groupBy({
        by: ['faturamentoId'],
        where: { ...bWhere, statusPagamento: StatusPagamento.VENCIDO },
        _sum: { valorBoleto: true },
        _count: { id: true },
      }),
    ]);

    const fatIds = rankingRows.map((r) => r.faturamentoId);
    const fats =
      fatIds.length > 0
        ? await this.prisma.faturamento.findMany({
            where: { id: { in: fatIds } },
            select: { id: true, clienteId: true },
          })
        : [];
    const fatCliente = new Map(fats.map((f) => [f.id, f.clienteId]));
    const valorPorCliente = new Map<string, number>();
    const qtdPorCliente = new Map<string, number>();
    for (const row of rankingRows) {
      const cid = fatCliente.get(row.faturamentoId);
      if (!cid) continue;
      valorPorCliente.set(cid, (valorPorCliente.get(cid) ?? 0) + num(row._sum.valorBoleto));
      qtdPorCliente.set(cid, (qtdPorCliente.get(cid) ?? 0) + row._count.id);
    }

    const cids = [...valorPorCliente.keys()];
    const nomes =
      cids.length > 0
        ? await this.prisma.cliente.findMany({
            where: { id: { in: cids }, deletedAt: null },
            select: { id: true, nome: true },
          })
        : [];
    const nomeMap = new Map(nomes.map((c) => [c.id, c.nome]));

    const ranking: DashboardFinanceiroRankingInadimplenciaDto[] = cids
      .map((id) => ({
        clienteId: id,
        clienteNome: nomeMap.get(id) ?? '',
        valorVencido: round2(valorPorCliente.get(id) ?? 0),
        quantidadeBoletosVencidos: qtdPorCliente.get(id) ?? 0,
      }))
      .sort((a, b) => b.valorVencido - a.valorVencido)
      .slice(0, 15);

    const vv = num(somaVenc._sum.valorBoleto);
    const vt = num(valorTotalBoletos._sum.valorBoleto);

    return {
      boletosPendentes: pendentes,
      boletosVencidos: vencidos,
      valorVencidoTotal: round2(vv),
      taxaInadimplenciaGeralPercent: vt > 0 ? round2((vv / vt) * 100) : null,
      inadimplenciaPorCliente: ranking,
    };
  }

  private async buildRentabilidade(
    fatWhereBase: Prisma.FaturamentoWhereInput,
  ): Promise<DashboardFinanceiroRentabilidadeDto> {
    const fsLinks = await this.prisma.faturamentoSolicitacao.findMany({
      where: { faturamento: fatWhereBase },
      select: { solicitacaoId: true },
      distinct: ['solicitacaoId'],
    });
    const solIds = fsLinks.map((x) => x.solicitacaoId);
    const unitCount =
      solIds.length > 0
        ? await this.prisma.unidade.count({
            where: { solicitacaoId: { in: solIds } },
          })
        : 0;

    const agg = await this.prisma.faturamento.aggregate({
      where: fatWhereBase,
      _sum: { valorTotal: true },
    });
    const total = num(agg._sum.valorTotal);

    const proxy = unitCount > 0 ? round2(total / unitCount) : null;

    return {
      proxyMargemOperacional: proxy,
      faturamentoPorContainer: proxy,
      totalUnidadesConsideradas: unitCount,
    };
  }

  private async buildAging(clienteId?: string): Promise<DashboardFinanceiroAgingDto[]> {
    const clienteFilter = clienteId ? Prisma.sql`AND f."clienteId" = ${clienteId}` : Prisma.empty;

    const rows = await this.prisma.$queryRaw<
      Array<{ faixa: string; valor: unknown; qtd: bigint }>
    >`
      SELECT x.faixa,
             SUM(x.val)::numeric AS valor,
             COUNT(*)::bigint AS qtd
      FROM (
        SELECT b.id,
               b."valorBoleto"::numeric AS val,
               CASE
                 WHEN b."statusPagamento"::text IN ('PAGO', 'CANCELADO') THEN 'nao_aplica'
                 WHEN CURRENT_DATE <= b."dataVencimento"::date THEN 'a_vencer'
                 WHEN (CURRENT_DATE - b."dataVencimento"::date) <= 30 THEN '0-30'
                 WHEN (CURRENT_DATE - b."dataVencimento"::date) <= 60 THEN '31-60'
                 WHEN (CURRENT_DATE - b."dataVencimento"::date) <= 90 THEN '61-90'
                 ELSE '91+'
               END AS faixa
        FROM boletos b
        INNER JOIN faturamentos f ON f.id = b."faturamentoId"
        WHERE b."statusPagamento"::text NOT IN ('PAGO', 'CANCELADO')
        ${clienteFilter}
      ) x
      WHERE x.faixa != 'nao_aplica'
      GROUP BY x.faixa
      ORDER BY x.faixa
    `;

    const order = ['a_vencer', '0-30', '31-60', '61-90', '91+'];
    const mapped = rows.map((r) => ({
      faixa: r.faixa,
      valorTotal: round2(Number(r.valor)),
      quantidadeBoletos: Number(r.qtd),
    }));
    mapped.sort((a, b) => {
      const ia = order.indexOf(a.faixa);
      const ib = order.indexOf(b.faixa);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
    return mapped;
  }

  private async buildSeries12(
    periodoFim: string,
    clienteId?: string,
  ): Promise<DashboardFinanceiroSerieTemporalDto[]> {
    const [yf, mf] = periodoFim.split('-').map((x) => parseInt(x, 10));
    const end = new Date(yf, mf - 1, 1);
    const start = new Date(yf, mf - 12, 1);
    const inicio = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
    const fim = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}`;
    const meses = mesesNoIntervalo(inicio, fim);
    if (meses.length > 12) meses.splice(0, meses.length - 12);

    const clienteFilter = clienteId ? Prisma.sql`AND f."clienteId" = ${clienteId}` : Prisma.empty;

    const series: DashboardFinanceiroSerieTemporalDto[] = [];
    for (const mes of meses) {
      const row = await this.prisma.$queryRaw<
        Array<{ faturado: unknown; recebido: unknown; pendente: unknown; vencido: unknown }>
      >`
        SELECT
          COALESCE(SUM(f."valorTotal"), 0)::numeric AS faturado,
          COALESCE(SUM(CASE WHEN b."statusPagamento"::text = 'PAGO' THEN b."valorBoleto" ELSE 0 END), 0)::numeric AS recebido,
          COALESCE(SUM(CASE WHEN b."statusPagamento"::text = 'PENDENTE' THEN b."valorBoleto" ELSE 0 END), 0)::numeric AS pendente,
          COALESCE(SUM(CASE WHEN b."statusPagamento"::text = 'VENCIDO'
              OR (b."statusPagamento"::text = 'PENDENTE' AND b."dataVencimento"::date < CURRENT_DATE)
            THEN b."valorBoleto" ELSE 0 END), 0)::numeric AS vencido
        FROM faturamentos f
        LEFT JOIN boletos b ON b."faturamentoId" = f.id
        WHERE f.periodo = ${mes}
        ${clienteFilter}
      `;
      const r = row[0];
      series.push({
        mes,
        faturado: round2(Number(r?.faturado ?? 0)),
        recebido: round2(Number(r?.recebido ?? 0)),
        pendente: round2(Number(r?.pendente ?? 0)),
        vencido: round2(Number(r?.vencido ?? 0)),
      });
    }

    return series;
  }

  private async buildClientesExecutivo(
    fatWhereBase: Prisma.FaturamentoWhereInput,
    clienteIdFilter?: string,
  ): Promise<DashboardFinanceiroClientesDto> {
    const byCliente = await this.prisma.faturamento.groupBy({
      by: ['clienteId'],
      where: fatWhereBase,
      _sum: { valorTotal: true },
    });

    const total = byCliente.reduce((a, r) => a + num(r._sum.valorTotal), 0);

    const ids = byCliente.map((b) => b.clienteId);
    const clientes =
      ids.length > 0
        ? await this.prisma.cliente.findMany({
            where: { id: { in: ids }, deletedAt: null },
            select: { id: true, nome: true, tipo: true },
          })
        : [];
    const meta = new Map(clientes.map((c) => [c.id, c]));

    const sorted = [...byCliente].sort(
      (a, b) => num(b._sum.valorTotal) - num(a._sum.valorTotal),
    );

    let cumValor = 0;
    const abc: DashboardFinanceiroAbcDto[] = sorted.map((row) => {
      const v = num(row._sum.valorTotal);
      const antesPct = total > 0 ? (cumValor / total) * 100 : 0;
      cumValor += v;
      const cumPct = total > 0 ? (cumValor / total) * 100 : 0;
      const classe: 'A' | 'B' | 'C' =
        antesPct < 80 ? 'A' : antesPct < 95 ? 'B' : 'C';

      const c = meta.get(row.clienteId);
      return {
        clienteId: row.clienteId,
        clienteNome: c?.nome ?? '',
        valor: round2(v),
        percentualAcumulado: round2(cumPct),
        classe,
      };
    });

    let receitaPj = 0;
    let receitaPf = 0;
    for (const row of byCliente) {
      const v = num(row._sum.valorTotal);
      const c = meta.get(row.clienteId);
      if (c?.tipo === TipoCliente.PJ) receitaPj += v;
      else receitaPf += v;
    }
    const corpTotal = receitaPj + receitaPf;

    let visao: DashboardFinanceiroClientesDto['visaoClienteFiltrado'] = null;
    if (clienteIdFilter) {
      const c = await this.prisma.cliente.findFirst({
        where: { id: clienteIdFilter, deletedAt: null },
      });
      const fatCliente = await this.prisma.faturamento.aggregate({
        where: fatWhereBase,
        _sum: { valorTotal: true },
      });
      const boAbertos = await this.prisma.boleto.count({
        where: {
          statusPagamento: { in: [StatusPagamento.PENDENTE, StatusPagamento.VENCIDO] },
          faturamento: { clienteId: clienteIdFilter },
        },
      });
      const vinad = await this.prisma.boleto.aggregate({
        where: {
          statusPagamento: StatusPagamento.VENCIDO,
          faturamento: { clienteId: clienteIdFilter },
        },
        _sum: { valorBoleto: true },
      });
      visao = {
        clienteId: clienteIdFilter,
        clienteNome: c?.nome ?? '',
        faturamentoTotalPeriodo: round2(num(fatCliente._sum.valorTotal)),
        quantidadeBoletosAbertos: boAbertos,
        valorInadimplente: round2(num(vinad._sum.valorBoleto)),
      };
    }

    return {
      curvaAbc: abc,
      corporate: {
        receitaPj: round2(receitaPj),
        receitaPf: round2(receitaPf),
        percentualParticipacaoPj: corpTotal > 0 ? round2((receitaPj / corpTotal) * 100) : null,
      },
      visaoClienteFiltrado: visao,
    };
  }

  /** Média móvel simples (3 meses) para faturamento; inadimplência ponderada nos últimos 3 pontos da série. */
  private forecastFromSeries(series: DashboardFinanceiroSerieTemporalDto[]): {
    forecastFatNext: number | null;
    forecastInadPercent: number | null;
  } {
    const last3 = series.slice(-3).map((s) => s.faturado);
    const forecastFatNext =
      last3.length > 0 ? round2(last3.reduce((a, b) => a + b, 0) / last3.length) : null;

    const rates = series.slice(-6).map((s) => {
      const denom = s.recebido + s.vencido + s.pendente;
      return denom > 0 ? s.vencido / denom : 0;
    });
    const w = [1, 2, 3];
    const slice = rates.slice(-3);
    let forecastInadPercent: number | null = null;
    if (slice.length > 0) {
      const wi = w.slice(-slice.length);
      let nume = 0;
      let deno = 0;
      for (let i = 0; i < slice.length; i++) {
        nume += slice[i] * wi[i];
        deno += wi[i];
      }
      forecastInadPercent = deno > 0 ? round2((nume / deno) * 100) : null;
    }

    return { forecastFatNext, forecastInadPercent };
  }
}
