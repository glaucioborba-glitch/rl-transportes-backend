import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AcaoAuditoria, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  analisarEquilibrioOperacional,
  construirCapexPlanejado,
  construirForecastFinanceiro,
  projetarDemanda12Meses,
  projetarOpex12Meses,
  simularCenarioEstrategico,
  type MesValor,
} from './planejamento-estrategico.calculations';
import type {
  PlanejamentoCapexQueryDto,
  PlanejamentoCenarioEstrategicoQueryDto,
  PlanejamentoForecastFinanceiroQueryDto,
} from './dto/planejamento-estrategico-query.dto';
import type {
  PlanejamentoCapexRespostaDto,
  PlanejamentoCenarioEstrategicoRespostaDto,
  PlanejamentoDemandaAnualRespostaDto,
  PlanejamentoEquilibrioRespostaDto,
  PlanejamentoForecastFinanceiroRespostaDto,
  PlanejamentoOpexRespostaDto,
} from './dto/planejamento-estrategico-response.dto';

const OP_TABLES = ['portarias', 'gates', 'patios', 'saidas'] as const;

function num(d: Prisma.Decimal | bigint | null | undefined): number {
  if (d === null || d === undefined) return 0;
  if (typeof d === 'bigint') return Number(d);
  return Number(d.toFixed(2));
}

@Injectable()
export class PlanejamentoEstrategicoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private capacidadeSlots(): number {
    const v = parseInt(
      this.config.get<string>('PERFORMANCE_PATIO_CAPACIDADE_ESTIMADA') ??
        this.config.get<string>('SIMULADOR_SLOTS_CAPACIDADE_TOTAL') ??
        '200',
      10,
    );
    return Number.isFinite(v) && v > 0 ? v : 200;
  }

  private custoMinutoProxy(): number {
    const v = parseFloat(this.config.get<string>('PERFORMANCE_CUSTO_MINUTO_PROXY') ?? '0.05');
    return Number.isFinite(v) && v >= 0 ? v : 0.05;
  }

  private margemMediaPctDefault(): number {
    const v = parseFloat(this.config.get<string>('PLANEJAMENTO_MARGEM_MEDIA_PCT') ?? '22');
    return Number.isFinite(v) && v > 0 ? v : 22;
  }

  private elasticidadeProxy(): number {
    const v = parseFloat(this.config.get<string>('PLANEJAMENTO_ELASTICIDADE_PROXY') ?? '-0.35');
    return Number.isFinite(v) ? v : -0.35;
  }

  private m2PorSlot(): number {
    const v = parseFloat(this.config.get<string>('SIMULADOR_M2_POR_SLOT_PROXY') ?? '36');
    return Number.isFinite(v) && v > 0 ? v : 36;
  }

  private custoM2ExpansaoProxy(): number {
    const v = parseFloat(this.config.get<string>('SIMULADOR_CUSTO_EXPANSAO_M2_PROXY') ?? '850');
    return Number.isFinite(v) && v > 0 ? v : 850;
  }

  private margemPorSlotAnualProxy(): number {
    const v = parseFloat(this.config.get<string>('SIMULADOR_MARGEM_OPER_SLOT_PROXY') ?? '120');
    return Number.isFinite(v) && v > 0 ? v : 120;
  }

  async getDemandaAnual(): Promise<PlanejamentoDemandaAnualRespostaDto> {
    const ini = new Date();
    ini.setFullYear(ini.getFullYear() - 3);
    ini.setDate(1);
    ini.setHours(0, 0, 0, 0);

    const rows = await this.prisma.$queryRaw<Array<{ mes: string; n: bigint }>>`
      SELECT TO_CHAR(sa."dataHoraSaida", 'YYYY-MM') AS mes, COUNT(*)::bigint AS n
      FROM saidas sa
      JOIN solicitacoes s ON s.id = sa."solicitacaoId"
      WHERE s."deletedAt" IS NULL
        AND sa."dataHoraSaida" >= ${ini}
      GROUP BY 1
      ORDER BY 1
    `;

    const historico: MesValor[] = rows.map((r) => ({
      mes: r.mes,
      valor: Number(r.n),
    }));

    const out = projetarDemanda12Meses(historico);

    return {
      volumePrevisto: out.volumePrevisto.map((x) => ({ mes: x.mes, valor: x.valor })),
      confianca: out.confiancaPct,
      tendencia: out.tendencia,
      mesesHistoricosConsiderados: historico.length,
    };
  }

  async getForecastFinanceiro(
    query: PlanejamentoForecastFinanceiroQueryDto,
  ): Promise<PlanejamentoForecastFinanceiroRespostaDto> {
    const crescimento = query.crescimentoEsperadoPctAnual ?? 5;
    const ini = new Date();
    ini.setFullYear(ini.getFullYear() - 4);
    ini.setDate(1);
    ini.setHours(0, 0, 0, 0);

    const rows = await this.prisma.$queryRaw<Array<{ mes: string; v: Prisma.Decimal | null }>>`
      SELECT TO_CHAR(f."createdAt", 'YYYY-MM') AS mes, SUM(f."valorTotal") AS v
      FROM faturamentos f
      WHERE f."createdAt" >= ${ini}
      GROUP BY 1
      ORDER BY 1
    `;

    const receitaHist: MesValor[] = rows.map((r) => ({
      mes: r.mes,
      valor: num(r.v),
    }));

    const margemPct = this.margemMediaPctDefault();
    const el = this.elasticidadeProxy();

    const fin = construirForecastFinanceiro(receitaHist, margemPct, el, crescimento);

    return {
      receitaPrevistaAnual: fin.receitaTotalPrevista,
      margemPrevistaAnual: fin.margemTotalPrevista,
      curva12Meses: fin.mesAMes.map((x) => ({ mes: x.mes, valor: x.valor })),
      otimista: { receitaTotal: fin.otimista.receitaTotal, margemTotal: fin.otimista.margemTotal },
      base: { receitaTotal: fin.base.receitaTotal, margemTotal: fin.base.margemTotal },
      pessimista: {
        receitaTotal: fin.pessimista.receitaTotal,
        margemTotal: fin.pessimista.margemTotal,
      },
      margemMediaHistoricaPct: margemPct,
      elasticidadeDemandaProxy: el,
      crescimentoEsperadoPctAnualAplicado: crescimento,
    };
  }

  async getOpex(): Promise<PlanejamentoOpexRespostaDto> {
    const ini = new Date();
    ini.setDate(ini.getDate() - 90);

    const [ops, cicloRows, usuarios, ocupacaoPatio, patioCap] = await Promise.all([
      this.prisma.auditoria.count({
        where: {
          createdAt: { gte: ini },
          acao: AcaoAuditoria.INSERT,
          tabela: { in: [...OP_TABLES] },
        },
      }),
      this.prisma.$queryRaw<Array<{ m: number | null }>>`
        SELECT AVG(EXTRACT(EPOCH FROM (sa."dataHoraSaida" - po."createdAt")) / 60.0) AS m
        FROM solicitacoes s
        JOIN portarias po ON po."solicitacaoId" = s.id
        JOIN gates g ON g."solicitacaoId" = s.id
        JOIN patios pt ON pt."solicitacaoId" = s.id
        JOIN saidas sa ON sa."solicitacaoId" = s.id
        WHERE s."deletedAt" IS NULL
          AND sa."dataHoraSaida" >= ${ini}
      `,
      this.prisma.auditoria.groupBy({
        by: ['usuario'],
        where: {
          createdAt: { gte: ini },
          acao: AcaoAuditoria.INSERT,
          tabela: { in: [...OP_TABLES] },
        },
        _count: { id: true },
      }),
      this.prisma.patio.count(),
      Promise.resolve(this.capacidadeSlots()),
    ]);

    const cicloMin = cicloRows[0]?.m !== null && cicloRows[0]?.m !== undefined ? Number(cicloRows[0].m) : 240;
    const custoMin = this.custoMinutoProxy();
    const custoPorOp = cicloMin * 60 * custoMin;

    const meses = 3;
    const operacoesMesMedio = ops / Math.max(1, meses);
    const custoTurnoFixoMensal =
      parseFloat(this.config.get<string>('PLANEJAMENTO_OPEX_TURNO_FIXO_MENSAL') ?? '42000') || 42000;
    const custoPorOperadorMes =
      parseFloat(this.config.get<string>('PLANEJAMENTO_OPEX_OPERADOR_MES') ?? '8500') || 8500;

    const ocupacaoPct = patioCap > 0 ? (ocupacaoPatio / patioCap) * 100 : 0;
    const custoPatioVariavel =
      parseFloat(this.config.get<string>('PLANEJAMENTO_OPEX_PATIO_VAR_PCT') ?? '18000') || 18000;

    const opex = projetarOpex12Meses({
      custoPorOperacaoProxy: custoPorOp,
      operacoesMesMedio,
      custoTurnoFixoMensal,
      custoPorOperadorMes,
      numOperadoresEquivalentes: Math.max(3, Math.ceil(usuarios.length * 0.85)),
      custoPatioVariavelPorPctOcupacao: custoPatioVariavel,
      ocupacaoMediaPct: ocupacaoPct,
    });

    const premissas =
      'OPEX proxy: auditoria operacional × ciclo médio × custo/minuto + fixos por turno e operador + variável de pátio.';

    return {
      custoMensalPrevisto: opex.custoMensalPrevisto.map((x) => ({ mes: x.mes, valor: x.valor })),
      custoPorUnidade: opex.custoPorUnidade,
      premissasResumo: premissas,
    };
  }

  async getCapex(query: PlanejamentoCapexQueryDto): Promise<PlanejamentoCapexRespostaDto> {
    const slots = query.expansaoSlotsPlanejados ?? 80;
    const r = construirCapexPlanejado(slots, this.margemPorSlotAnualProxy(), this.custoM2ExpansaoProxy(), this.m2PorSlot());

    return {
      linhas: r.linhas.map((l) => ({
        categoria: l.categoria,
        investimentoEstimado: l.investimentoEstimado,
        capacidadeAdicionalSlots: l.capacidadeAdicionalSlots,
      })),
      investimentoNecessario: r.investimentoTotal,
      impactoCapacidadeSlots: r.capacidadeAdicionalTotalSlots,
      roiEstimadoMeses12: r.roiMeses12,
      roiEstimadoMeses24: r.roiMeses24,
      roiEstimadoMeses36: r.roiMeses36,
    };
  }

  async getEquilibrio(): Promise<PlanejamentoEquilibrioRespostaDto> {
    const demanda = await this.getDemandaAnual();
    const opex = await this.getOpex();
    const cap = this.capacidadeSlots();

    const demandaMedia =
      demanda.volumePrevisto.reduce((s, x) => s + x.valor, 0) /
      Math.max(1, demanda.volumePrevisto.length);

    const eq = analisarEquilibrioOperacional({
      capacidadeSlotsTotal: cap,
      demandaPrevistaMediaMensal: demandaMedia,
      custoPorUnidadeAtual: opex.custoPorUnidade,
      custoPorUnidadeAposExpansaoProxy: opex.custoPorUnidade * 0.92,
    });

    return {
      mesesAteDeficitCapacidade: eq.mesesAteDeficitCapacidade,
      expansaoReduzCustoPorUnidade: eq.expansaoReduzCustoPorUnidade,
      sweetSpotOcupacaoPct: eq.sweetSpotOcupacaoPct,
      observacao: eq.observacao,
      demandaMediaMensalProjetada: Math.round(demandaMedia * 100) / 100,
      capacidadeSlotsReferencia: cap,
    };
  }

  async getCenarioEstrategico(
    query: PlanejamentoCenarioEstrategicoQueryDto,
  ): Promise<PlanejamentoCenarioEstrategicoRespostaDto> {
    const fin = await this.getForecastFinanceiro({});
    const cap = this.capacidadeSlots();

    const r = simularCenarioEstrategico({
      aumentoDemandaPct: query.aumentoDemandaPct ?? 0,
      reducaoTurnoHoras: query.reducaoTurnoHoras ?? 0,
      aumentoTurnoHoras: query.aumentoTurnoHoras ?? 0,
      expansaoSlots: query.expansaoSlots ?? 0,
      investimentoAdicional: query.investimentoAdicional ?? 0,
      receitaBaseAnual: fin.receitaPrevistaAnual,
      margemPctBase: this.margemMediaPctDefault(),
      capacidadeSlots: cap,
    });

    return {
      impactoEmReceitaPct: r.impactoEmReceitaPct,
      impactoEmMargemPctPontos: r.impactoEmMargemPctPontos,
      impactoEmCapacidadePctPontos: r.impactoEmCapacidadePctPontos,
      riscoOperacional: r.riscoOperacional,
      recomendacaoExecutiva: r.recomendacaoExecutiva,
    };
  }
}
