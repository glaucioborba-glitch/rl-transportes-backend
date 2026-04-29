import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AcaoAuditoria, Prisma } from '@prisma/client';
import { parseRelatorioInicioFim } from '../common/utils/relatorio-periodo';
import { PrismaService } from '../prisma/prisma.service';
import {
  curvaAbcAcumuladoLucroOrdemFixa,
  curvaAbcPorLucratividade,
  elasticidadeDemandaPreco,
  simuladorComercial,
  type SerieMesVolPreco,
} from './comercial-pricing.calculations';
import type { ComercialCurvaAbcQueryDto } from './dto/comercial-curva-abc-query.dto';
import type { ComercialElasticidadeQueryDto } from './dto/comercial-elasticidade-query.dto';
import type { ComercialPeriodQueryDto } from './dto/comercial-period-query.dto';
import type {
  ComercialClienteLucroDto,
  ComercialCurvaAbcItemDto,
  ComercialCurvaAbcRespostaDto,
  ComercialElasticidadeRespostaDto,
  ComercialIndicadoresRespostaDto,
  ComercialLucroPorClienteRespostaDto,
  ComercialLucroPorServicoRespostaDto,
  ComercialParametrosCustoDto,
  ComercialRecomendacaoDto,
  ComercialRecomendacoesRespostaDto,
  ComercialSerieElasticidadeMesDto,
  ComercialSerieMesValorDto,
  ComercialSerieTemporalMesDto,
  ComercialSeriesTemporaisRespostaDto,
  ComercialServicoLucroDto,
  ComercialSimuladorRespostaDto,
} from './dto/comercial-response.dto';
import type { ComercialSeriesTemporaisQueryDto } from './dto/comercial-series-temporais-query.dto';
import type { ComercialSimuladorQueryDto } from './dto/comercial-simulador-query.dto';

const OP_TABLES = ['portarias', 'gates', 'patios', 'saidas'] as const;

function round2(n: number | null | undefined): number | null {
  if (n === null || n === undefined || Number.isNaN(n)) return null;
  return Math.round(n * 10000) / 10000;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function num(d: Prisma.Decimal | bigint | null | undefined): number {
  if (d === null || d === undefined) return 0;
  if (typeof d === 'bigint') return Number(d);
  return Number(d.toFixed(2));
}

function periodoYm(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function addMonthsYm(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const dt = new Date(y, (m ?? 1) - 1 + delta, 1);
  return periodoYm(dt);
}

@Injectable()
export class ComercialPricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private custoMinutoProxy(): number {
    const v = parseFloat(this.config.get<string>('PERFORMANCE_CUSTO_MINUTO_PROXY') ?? '0.05');
    return Number.isFinite(v) && v >= 0 ? v : 0.05;
  }

  /** Recorte padrão: 12 meses até hoje. */
  private resolvePeriodo(query: ComercialPeriodQueryDto): { ini: Date; fim: Date } {
    if (query.dataInicio && query.dataFim) {
      return parseRelatorioInicioFim(query.dataInicio, query.dataFim);
    }
    const fim = new Date();
    const ini = new Date(fim);
    ini.setFullYear(ini.getFullYear() - 1);
    ini.setHours(0, 0, 0, 0);
    fim.setHours(23, 59, 59, 999);
    return { ini, fim };
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
    const raw = rows[0]?.m;
    return raw !== null && raw !== undefined ? round2(raw) : null;
  }

  private async custoGlobalParams(
    ini: Date,
    fim: Date,
    clienteId?: string,
  ): Promise<{ parametros: ComercialParametrosCustoDto; custoTotal: number }> {
    const custoMin = this.custoMinutoProxy();
    const cicloHoras = await this.cicloCompletoHoras(ini, fim, clienteId);
    const ops = await this.prisma.auditoria.count({
      where: {
        createdAt: { gte: ini, lte: fim },
        tabela: { in: [...OP_TABLES] },
        acao: AcaoAuditoria.INSERT,
      },
    });
    const custoTotalRaw =
      cicloHoras !== null ? ops * cicloHoras * 60 * custoMin : ops * 60 * custoMin;
    const custoTotal = roundMoney(custoTotalRaw);
    const parametros: ComercialParametrosCustoDto = {
      custoOperacionalTotalEstimado: custoTotal,
      operacoesInsertConsideradas: ops,
      cicloMedioHoras: cicloHoras,
      custoMinutoProxy: custoMin,
    };
    return { parametros, custoTotal };
  }

  async getCurvaAbc(query: ComercialCurvaAbcQueryDto): Promise<ComercialCurvaAbcRespostaDto> {
    const { ini, fim } = this.resolvePeriodo(query);
    const filterCliente = query.clienteId;
    const modo = query.modo ?? 'lucro';

    const { parametros, custoTotal } = await this.custoGlobalParams(ini, fim, filterCliente);

    const fatRows = await this.prisma.faturamento.groupBy({
      by: ['clienteId'],
      where: {
        createdAt: { gte: ini, lte: fim },
        ...(filterCliente ? { clienteId: filterCliente } : {}),
      },
      _sum: { valorTotal: true },
    });

    const totalFat = fatRows.reduce((s, r) => s + num(r._sum.valorTotal), 0);

    const clienteIds = fatRows.map((r) => r.clienteId);
    const nomes = await this.prisma.cliente.findMany({
      where: { id: { in: clienteIds }, deletedAt: null },
      select: { id: true, nome: true },
    });
    const nomeMap = new Map(nomes.map((c) => [c.id, c.nome]));

    const abcInput = fatRows.map((r) => {
      const fat = num(r._sum.valorTotal);
      const custoEst =
        totalFat > 0 ? roundMoney((custoTotal * fat) / totalFat) : 0;
      const lucro = roundMoney(fat - custoEst);
      const margemPct = fat > 0 ? round2(lucro / fat) : null;
      return {
        id: r.clienteId,
        lucro,
        margemPct,
        _fat: fat,
        _custo: custoEst,
      };
    });

    const abcRows =
      modo === 'margem'
        ? curvaAbcAcumuladoLucroOrdemFixa(
            [...abcInput]
              .sort((a, b) => {
                const ma = a.margemPct ?? -1;
                const mb = b.margemPct ?? -1;
                if (mb !== ma) return mb - ma;
                return b.lucro - a.lucro;
              })
              .map((x) => ({ id: x.id, lucro: x.lucro })),
          )
        : curvaAbcPorLucratividade(abcInput.map((x) => ({ id: x.id, lucro: x.lucro })));
    const abcMap = new Map(abcRows.map((r) => [r.id, r]));

    const itens: ComercialCurvaAbcItemDto[] = abcInput.map((row) => {
      const meta = abcMap.get(row.id)!;
      const fat = row._fat;
      const margemPct = fat > 0 ? round2(row.lucro / fat) : null;
      return {
        clienteId: row.id,
        clienteNome: nomeMap.get(row.id) ?? '',
        faturamento: roundMoney(fat),
        custoEstimado: row._custo,
        lucro: row.lucro,
        margemPct,
        classe: meta.classe,
        contribuicaoLucroAcumPct: meta.contribuicaoLucroAcumPct,
      };
    });

    const concentracao = {
      classeA: itens.filter((i) => i.classe === 'A').length,
      classeB: itens.filter((i) => i.classe === 'B').length,
      classeC: itens.filter((i) => i.classe === 'C').length,
    };

    return {
      periodo: {
        dataInicio: ini.toISOString().slice(0, 10),
        dataFim: fim.toISOString().slice(0, 10),
      },
      modoOrdenacaoAbc: modo,
      parametros,
      concentracao: {
        classeA: concentracao.classeA,
        classeB: concentracao.classeB,
        classeC: concentracao.classeC,
      },
      itens,
    };
  }

  async getLucroPorCliente(query: ComercialPeriodQueryDto): Promise<ComercialLucroPorClienteRespostaDto> {
    const { ini, fim } = this.resolvePeriodo(query);
    const filterCliente = query.clienteId;
    const { parametros, custoTotal } = await this.custoGlobalParams(ini, fim, filterCliente);

    const fatRows = await this.prisma.faturamento.groupBy({
      by: ['clienteId'],
      where: {
        createdAt: { gte: ini, lte: fim },
        ...(filterCliente ? { clienteId: filterCliente } : {}),
      },
      _sum: { valorTotal: true },
    });

    const totalFat = fatRows.reduce((s, r) => s + num(r._sum.valorTotal), 0);

    const iniSerie = new Date(fim);
    iniSerie.setMonth(iniSerie.getMonth() - 11);
    const minYm = periodoYm(iniSerie);
    const maxYm = periodoYm(fim);

    const serieRows = await this.prisma.$queryRaw<
      Array<{ clienteId: string; mes: string; rec: unknown }>
    >`
      SELECT f."clienteId", f.periodo AS mes, SUM(f."valorTotal")::numeric AS rec
      FROM faturamentos f
      WHERE f.periodo >= ${minYm}
        AND f.periodo <= ${maxYm}
        ${filterCliente ? Prisma.sql`AND f."clienteId" = ${filterCliente}` : Prisma.empty}
      GROUP BY f."clienteId", f.periodo
    `;

    const totFatPorMes = new Map<string, number>();
    for (const row of serieRows) {
      const mes = row.mes;
      const v = num(row.rec as Prisma.Decimal);
      totFatPorMes.set(mes, (totFatPorMes.get(mes) ?? 0) + v);
    }

    const opsMesRows = await this.prisma.$queryRaw<Array<{ mes: string; c: bigint }>>`
      SELECT to_char(date_trunc('month', a."createdAt"), 'YYYY-MM') AS mes, COUNT(*)::bigint AS c
      FROM auditorias a
      WHERE a."createdAt" >= ${iniSerie}
        AND a."createdAt" <= ${fim}
        AND a.tabela IN ('portarias','gates','patios','saidas')
        AND a.acao = 'INSERT'
      GROUP BY date_trunc('month', a."createdAt")
      ORDER BY mes ASC
    `;
    const opsPorMes = new Map(opsMesRows.map((r) => [r.mes, Number(r.c)]));
    const cicloHoras = parametros.cicloMedioHoras ?? 1;
    const custoMin = parametros.custoMinutoProxy;
    const custoMesFactor = cicloHoras * 60 * custoMin;

    const custoGlobalPorMes = new Map<string, number>();
    for (const [mes, ops] of opsPorMes) {
      custoGlobalPorMes.set(mes, roundMoney(ops * custoMesFactor));
    }

    const seriePorCliente = new Map<string, Map<string, number>>();
    for (const row of serieRows) {
      const cid = row.clienteId;
      if (!seriePorCliente.has(cid)) seriePorCliente.set(cid, new Map());
      seriePorCliente.get(cid)!.set(row.mes, num(row.rec as Prisma.Decimal));
    }

    const nomes = await this.prisma.cliente.findMany({
      where: {
        id: { in: fatRows.map((r) => r.clienteId) },
        deletedAt: null,
      },
      select: { id: true, nome: true },
    });
    const nomeMap = new Map(nomes.map((c) => [c.id, c.nome]));

    const clientes: ComercialClienteLucroDto[] = fatRows.map((fr) => {
      const fat = num(fr._sum.valorTotal);
      const custoEst =
        totalFat > 0 ? roundMoney((custoTotal * fat) / totalFat) : 0;
      const lucro = roundMoney(fat - custoEst);
      const margemPct = fat > 0 ? round2(lucro / fat) : null;

      const mesMap = seriePorCliente.get(fr.clienteId);
      const serie12Meses: ComercialSerieMesValorDto[] = [];
      let cursorYm = minYm;
      while (cursorYm <= maxYm) {
        const recMes = mesMap?.get(cursorYm) ?? 0;
        const totMes = totFatPorMes.get(cursorYm) ?? 0;
        const cgMes = custoGlobalPorMes.get(cursorYm) ?? 0;
        const custoClienteMes =
          totMes > 0 ? roundMoney((cgMes * recMes) / totMes) : 0;
        const mp = recMes > 0 ? round2((recMes - custoClienteMes) / recMes) : null;
        serie12Meses.push({
          mes: cursorYm,
          faturamento: roundMoney(recMes),
          custoEstimado: custoClienteMes,
          margemPct: mp,
        });
        cursorYm = addMonthsYm(cursorYm, 1);
      }

      return {
        clienteId: fr.clienteId,
        clienteNome: nomeMap.get(fr.clienteId) ?? '',
        faturamento: roundMoney(fat),
        custoEstimado: custoEst,
        lucro,
        margemPct,
        serie12Meses,
      };
    });

    return {
      periodo: {
        dataInicio: ini.toISOString().slice(0, 10),
        dataFim: fim.toISOString().slice(0, 10),
      },
      parametros,
      clientes,
    };
  }

  async getLucroPorServico(query: ComercialPeriodQueryDto): Promise<ComercialLucroPorServicoRespostaDto> {
    const { ini, fim } = this.resolvePeriodo(query);
    const filterCliente = query.clienteId;
    const { parametros, custoTotal } = await this.custoGlobalParams(ini, fim, filterCliente);

    const unitsByTipo = await this.prisma.unidade.groupBy({
      by: ['tipo'],
      where: {
        solicitacao: {
          deletedAt: null,
          ...(filterCliente ? { clienteId: filterCliente } : {}),
          saida: {
            dataHoraSaida: { gte: ini, lte: fim },
          },
        },
      },
      _count: { id: true },
    });

    const totalUn = unitsByTipo.reduce((s, r) => s + r._count.id, 0);

    const fatTotal = await this.prisma.faturamento.aggregate({
      where: {
        createdAt: { gte: ini, lte: fim },
        ...(filterCliente ? { clienteId: filterCliente } : {}),
      },
      _sum: { valorTotal: true },
    });
    const receitaTotal = num(fatTotal._sum.valorTotal);

    const servicos: ComercialServicoLucroDto[] = unitsByTipo.map((u) => {
      const n = u._count.id;
      const fatTipo =
        totalUn > 0 && receitaTotal > 0 ? roundMoney((receitaTotal * n) / totalUn) : 0;
      const custoTipo =
        receitaTotal > 0 ? roundMoney((custoTotal * fatTipo) / receitaTotal) : 0;
      const lucro = roundMoney(fatTipo - custoTipo);
      const margemPct = fatTipo > 0 ? round2(lucro / fatTipo) : null;
      return {
        tipo: u.tipo as unknown as string,
        unidades: n,
        faturamentoAlocado: fatTipo,
        custoEstimado: custoTipo,
        lucro,
        margemPct,
      };
    });

    return {
      periodo: {
        dataInicio: ini.toISOString().slice(0, 10),
        dataFim: fim.toISOString().slice(0, 10),
      },
      parametros,
      servicos,
    };
  }

  async getElasticidade(query: ComercialElasticidadeQueryDto): Promise<ComercialElasticidadeRespostaDto> {
    const meses = query.meses ?? 12;
    let ini: Date;
    let fimAdj: Date;
    if (query.dataInicio && query.dataFim) {
      const r = parseRelatorioInicioFim(query.dataInicio, query.dataFim);
      ini = r.ini;
      fimAdj = r.fim;
    } else {
      fimAdj = new Date();
      fimAdj.setHours(23, 59, 59, 999);
      ini = new Date(fimAdj);
      ini.setMonth(ini.getMonth() - meses);
      ini.setHours(0, 0, 0, 0);
    }

    const filterCliente = query.clienteId;
    const cf = filterCliente ? Prisma.sql`AND s."clienteId" = ${filterCliente}` : Prisma.empty;

    const volRows = await this.prisma.$queryRaw<Array<{ mes: string; vol: bigint }>>`
      SELECT to_char(date_trunc('month', sa."dataHoraSaida"), 'YYYY-MM') AS mes,
             COUNT(u.id)::bigint AS vol
      FROM unidades_solicitacao u
      INNER JOIN solicitacoes s ON s.id = u."solicitacaoId"
      INNER JOIN saidas sa ON sa."solicitacaoId" = s.id
      WHERE s."deletedAt" IS NULL
        AND sa."dataHoraSaida" >= ${ini}
        AND sa."dataHoraSaida" <= ${fimAdj}
        ${cf}
      GROUP BY date_trunc('month', sa."dataHoraSaida")
      ORDER BY mes ASC
    `;

    const minYm = periodoYm(ini);
    const maxYm = periodoYm(fimAdj);

    const recRows = await this.prisma.$queryRaw<Array<{ mes: string; rec: unknown }>>`
      SELECT f.periodo AS mes, SUM(f."valorTotal")::numeric AS rec
      FROM faturamentos f
      WHERE f.periodo >= ${minYm}
        AND f.periodo <= ${maxYm}
        ${filterCliente ? Prisma.sql`AND f."clienteId" = ${filterCliente}` : Prisma.empty}
      GROUP BY f.periodo
      ORDER BY mes ASC
    `;

    const volMap = new Map(volRows.map((r) => [r.mes, Number(r.vol)]));
    const recMap = new Map(recRows.map((r) => [r.mes, num(r.rec as Prisma.Decimal)]));

    const serie: ComercialSerieElasticidadeMesDto[] = [];
    const elasticSeries: SerieMesVolPreco[] = [];

    let ym = minYm;
    while (ym <= maxYm) {
      const vol = volMap.get(ym) ?? 0;
      const rec = recMap.get(ym) ?? 0;
      const precoMedio = vol > 0 ? roundMoney(rec / vol) : 0;
      serie.push({ mes: ym, volumeUnidades: vol, precoMedio });
      elasticSeries.push({ mes: ym, volume: vol, precoMedio });
      ym = addMonthsYm(ym, 1);
    }

    const elasticidadeMedia = elasticidadeDemandaPreco(elasticSeries);

    const mesesInformados =
      query.dataInicio && query.dataFim
        ? Math.max(
            1,
            (fimAdj.getFullYear() - ini.getFullYear()) * 12 +
              (fimAdj.getMonth() - ini.getMonth()) +
              1,
          )
        : meses;

    return {
      mesesConsiderados: mesesInformados,
      elasticidadeMedia: elasticidadeMedia !== null ? round2(elasticidadeMedia) : null,
      serie,
      clienteId: filterCliente ?? null,
    };
  }

  async getSeriesTemporais(
    query: ComercialSeriesTemporaisQueryDto,
  ): Promise<ComercialSeriesTemporaisRespostaDto> {
    const meses = query.meses;
    const fim = new Date();
    fim.setHours(23, 59, 59, 999);
    const ini = new Date(fim);
    ini.setMonth(ini.getMonth() - meses);
    ini.setHours(0, 0, 0, 0);
    const filterCliente = query.clienteId;

    const { parametros } = await this.custoGlobalParams(ini, fim, filterCliente);

    const minYm = periodoYm(ini);
    const maxYm = periodoYm(fim);

    const recClienteRows = await this.prisma.$queryRaw<Array<{ mes: string; rec: unknown }>>`
      SELECT f.periodo AS mes, SUM(f."valorTotal")::numeric AS rec
      FROM faturamentos f
      WHERE f.periodo >= ${minYm}
        AND f.periodo <= ${maxYm}
        ${filterCliente ? Prisma.sql`AND f."clienteId" = ${filterCliente}` : Prisma.empty}
      GROUP BY f.periodo
      ORDER BY mes ASC
    `;

    const recGlobalRows = filterCliente
      ? await this.prisma.$queryRaw<Array<{ mes: string; rec: unknown }>>`
          SELECT f.periodo AS mes, SUM(f."valorTotal")::numeric AS rec
          FROM faturamentos f
          WHERE f.periodo >= ${minYm}
            AND f.periodo <= ${maxYm}
          GROUP BY f.periodo
          ORDER BY mes ASC
        `
      : recClienteRows;

    const totFatPorMes = new Map<string, number>();
    for (const row of recGlobalRows) {
      totFatPorMes.set(row.mes, num(row.rec as Prisma.Decimal));
    }

    const fatClientePorMes = new Map(
      recClienteRows.map((r) => [r.mes, num(r.rec as Prisma.Decimal)]),
    );

    const opsMesRows = await this.prisma.$queryRaw<Array<{ mes: string; c: bigint }>>`
      SELECT to_char(date_trunc('month', a."createdAt"), 'YYYY-MM') AS mes, COUNT(*)::bigint AS c
      FROM auditorias a
      WHERE a."createdAt" >= ${ini}
        AND a."createdAt" <= ${fim}
        AND a.tabela IN ('portarias','gates','patios','saidas')
        AND a.acao = 'INSERT'
      GROUP BY date_trunc('month', a."createdAt")
      ORDER BY mes ASC
    `;
    const opsPorMes = new Map(opsMesRows.map((r) => [r.mes, Number(r.c)]));
    const cicloHoras = parametros.cicloMedioHoras ?? 1;
    const custoMesFactor = cicloHoras * 60 * parametros.custoMinutoProxy;

    const custoGlobalPorMes = new Map<string, number>();
    for (const [mes, ops] of opsPorMes) {
      custoGlobalPorMes.set(mes, roundMoney(ops * custoMesFactor));
    }

    const serie: ComercialSerieTemporalMesDto[] = [];
    let ym = minYm;
    while (ym <= maxYm) {
      const fatMes = filterCliente ? fatClientePorMes.get(ym) ?? 0 : totFatPorMes.get(ym) ?? 0;
      const totMes = totFatPorMes.get(ym) ?? 0;
      const cgMes = custoGlobalPorMes.get(ym) ?? 0;
      let custoLinha: number;
      if (filterCliente) {
        custoLinha =
          totMes > 0 ? roundMoney((cgMes * (fatClientePorMes.get(ym) ?? 0)) / totMes) : 0;
      } else {
        custoLinha = cgMes;
      }
      const lucroLinha = roundMoney(fatMes - custoLinha);
      const mp = fatMes > 0 ? round2(lucroLinha / fatMes) : null;
      serie.push({
        mes: ym,
        faturamento: roundMoney(fatMes),
        custoEstimado: custoLinha,
        lucro: lucroLinha,
        margemPct: mp,
      });
      ym = addMonthsYm(ym, 1);
    }

    return {
      meses,
      periodo: {
        dataInicio: ini.toISOString().slice(0, 10),
        dataFim: fim.toISOString().slice(0, 10),
      },
      clienteId: filterCliente ?? null,
      parametros,
      serie,
    };
  }

  async getIndicadores(query: ComercialPeriodQueryDto): Promise<ComercialIndicadoresRespostaDto> {
    const { ini, fim } = this.resolvePeriodo(query);
    const cid = query.clienteId;

    const { parametros, custoTotal } = await this.custoGlobalParams(ini, fim, cid);

    const fatAgg = await this.prisma.faturamento.aggregate({
      where: {
        createdAt: { gte: ini, lte: fim },
        ...(cid ? { clienteId: cid } : {}),
      },
      _sum: { valorTotal: true },
    });
    const totalFat = num(fatAgg._sum.valorTotal);
    const lucroEstimado = roundMoney(totalFat - custoTotal);
    const margemMediaPct = totalFat > 0 ? round2(lucroEstimado / totalFat) : null;

    const grp = await this.prisma.faturamento.groupBy({
      by: ['clienteId'],
      where: {
        createdAt: { gte: ini, lte: fim },
        ...(cid ? { clienteId: cid } : {}),
      },
    });
    const quantidadeClientesComFaturamento = grp.length;

    const el = await this.getElasticidade({
      meses: 12,
      clienteId: cid,
    });

    return {
      periodo: {
        dataInicio: ini.toISOString().slice(0, 10),
        dataFim: fim.toISOString().slice(0, 10),
      },
      clienteId: cid ?? null,
      faturamentoTotal: roundMoney(totalFat),
      lucroEstimado,
      margemMediaPct,
      quantidadeClientesComFaturamento,
      elasticidadeDemandaMedia: el.elasticidadeMedia,
      parametros,
    };
  }

  getSimulador(query: ComercialSimuladorQueryDto): ComercialSimuladorRespostaDto {
    const out = simuladorComercial({
      precoAtual: query.precoAtual,
      precoNovo: query.precoNovo,
      custo: query.custo,
      volumeAtual: query.volumeAtual,
      elasticidade: query.elasticidade,
    });
    return {
      periodoRotulo: query.periodo ?? null,
      margemAtual: out.margemAtual,
      margemNova: out.margemNova,
      impactoReceitaLinear: out.impactoReceitaLinear,
      impactoVolumeEstimado: out.impactoVolumeEstimado,
      receitaAtual: out.receitaAtual,
      receitaNovaEstimada: out.receitaNovaEstimada,
      volumeEstimado: out.volumeEstimado,
      elasticidadeAplicada: out.elasticidadeAplicada,
    };
  }

  async getRecomendacoes(query: ComercialPeriodQueryDto): Promise<ComercialRecomendacoesRespostaDto> {
    const { ini, fim } = this.resolvePeriodo(query);
    const filterCliente = query.clienteId;

    const { custoTotal } = await this.custoGlobalParams(ini, fim, filterCliente);

    const fatRows = await this.prisma.faturamento.groupBy({
      by: ['clienteId'],
      where: {
        createdAt: { gte: ini, lte: fim },
        ...(filterCliente ? { clienteId: filterCliente } : {}),
      },
      _sum: { valorTotal: true },
    });

    const totalFat = fatRows.reduce((s, r) => s + num(r._sum.valorTotal), 0);

    const nomes = await this.prisma.cliente.findMany({
      where: { id: { in: fatRows.map((x) => x.clienteId) }, deletedAt: null },
      select: { id: true, nome: true },
    });
    const nomeMap = new Map(nomes.map((c) => [c.id, c.nome]));

    const unidadesPorCliente = await this.prisma.$queryRaw<
      Array<{ clienteId: string; u: bigint }>
    >`
      SELECT s."clienteId", COUNT(u.id)::bigint AS u
      FROM unidades_solicitacao u
      INNER JOIN solicitacoes s ON s.id = u."solicitacaoId"
      INNER JOIN saidas sa ON sa."solicitacaoId" = s.id
      WHERE s."deletedAt" IS NULL
        AND sa."dataHoraSaida" >= ${ini}
        AND sa."dataHoraSaida" <= ${fim}
        ${filterCliente ? Prisma.sql`AND s."clienteId" = ${filterCliente}` : Prisma.empty}
      GROUP BY s."clienteId"
    `;
    const uniMap = new Map(unidadesPorCliente.map((r) => [r.clienteId, Number(r.u)]));

    const rowsLucro = fatRows.map((r) => {
      const fat = num(r._sum.valorTotal);
      const custoEst =
        totalFat > 0 ? roundMoney((custoTotal * fat) / totalFat) : 0;
      const lucro = roundMoney(fat - custoEst);
      const margemPct = fat > 0 ? lucro / fat : null;
      const unidades = uniMap.get(r.clienteId) ?? 0;
      const intensidade = fat > 0 ? unidades / fat : 0;
      return {
        clienteId: r.clienteId,
        nome: nomeMap.get(r.clienteId) ?? '',
        fat,
        margemPct,
        lucro,
        intensidade,
      };
    });

    const abc = curvaAbcPorLucratividade(rowsLucro.map((x) => ({ id: x.clienteId, lucro: x.lucro })));
    const classePorCliente = new Map(abc.map((a) => [a.id, a.classe]));

    const intensidades = rowsLucro.map((r) => r.intensidade).sort((a, b) => a - b);
    const medianaInt =
      intensidades.length > 0
        ? intensidades[Math.floor(intensidades.length / 2)] ?? 0
        : 0;

    const inadRaw = await this.prisma.$queryRaw<
      Array<{ clienteId: string; pend: bigint; tot: bigint }>
    >`
      SELECT f."clienteId",
             SUM(CASE WHEN b."statusPagamento" <> ${'PAGO'} THEN 1 ELSE 0 END)::bigint AS pend,
             COUNT(b.id)::bigint AS tot
      FROM boletos b
      INNER JOIN faturamentos f ON f.id = b."faturamentoId"
      WHERE f."createdAt" >= ${ini}
        AND f."createdAt" <= ${fim}
        ${filterCliente ? Prisma.sql`AND f."clienteId" = ${filterCliente}` : Prisma.empty}
      GROUP BY f."clienteId"
    `;

    const inadMap = new Map(
      inadRaw.map((r) => [
        r.clienteId,
        { pend: Number(r.pend), tot: Number(r.tot) },
      ]),
    );

    const recomendacoes: ComercialRecomendacaoDto[] = [];

    for (const r of rowsLucro) {
      const classe = classePorCliente.get(r.clienteId)!;

      if (r.margemPct !== null && r.margemPct < 0.12) {
        recomendacoes.push({
          tipo: 'reajuste',
          clienteId: r.clienteId,
          clienteNome: r.nome,
          titulo: 'Margem comprimida — revisar tabela ou SLA',
          descricao:
            `Margem estimada ${(r.margemPct * 100).toFixed(1)}% no período. Avaliar reajuste de preços, descontos ou revisão de tempo operacional contratual.`,
          prioridade: 'alta',
        });
      }

      if (r.margemPct !== null && r.margemPct > 0.38 && r.fat > 0) {
        recomendacoes.push({
          tipo: 'contrato',
          clienteId: r.clienteId,
          clienteNome: r.nome,
          titulo: 'Cliente altamente rentável — fortalecer vínculo',
          descricao:
            'Margem elevada no período; considerar contrato de médio prazo, desconto por volume ou programa de fidelidade.',
          prioridade: 'media',
        });
      }

      if (
        classe === 'A' &&
        r.margemPct !== null &&
        r.margemPct >= 0.26 &&
        r.margemPct <= 0.34
      ) {
        recomendacoes.push({
          tipo: 'desconto',
          clienteId: r.clienteId,
          clienteNome: r.nome,
          titulo: 'Curva A com margem compatível com incentivo por volume',
          descricao:
            'Avaliar desconto escalonado, rebate por meta ou precificação por pacote de movimentações.',
          prioridade: 'baixa',
        });
      }

      if (classe === 'C' && r.lucro <= 0) {
        recomendacoes.push({
          tipo: 'pacote',
          clienteId: r.clienteId,
          clienteNome: r.nome,
          titulo: 'Curva C com lucro líquido não positivo',
          descricao:
            'Cliente na cauda da curva ABC com resultado frágil; avaliar pacote mínimo, fee fixo ou encerramento gradual.',
          prioridade: 'media',
        });
      }

      if (r.intensidade > medianaInt * 1.35 && medianaInt > 0) {
        recomendacoes.push({
          tipo: 'ocupacao',
          clienteId: r.clienteId,
          clienteNome: r.nome,
          titulo: 'Alta intensidade operacional vs faturamento',
          descricao:
            'Volume de unidades elevado em relação ao faturamento — avaliar componente de preço por ocupação de pátio ou dwell time.',
          prioridade: 'baixa',
        });
      }

      const ind = inadMap.get(r.clienteId);
      if (ind && ind.tot > 0 && ind.pend / ind.tot >= 0.4) {
        recomendacoes.push({
          tipo: 'alerta',
          clienteId: r.clienteId,
          clienteNome: r.nome,
          titulo: 'Boletos em aberto acima do esperado',
          descricao: `Em ${ind.pend} de ${ind.tot} boletos no período não constam como pagos; revisar condições comerciais ou cobrança.`,
          prioridade: 'alta',
        });
      }
    }

    return {
      periodo: {
        dataInicio: ini.toISOString().slice(0, 10),
        dataFim: fim.toISOString().slice(0, 10),
      },
      recomendacoes,
    };
  }
}
