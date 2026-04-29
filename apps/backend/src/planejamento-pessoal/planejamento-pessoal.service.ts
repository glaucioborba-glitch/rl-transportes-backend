import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AcaoAuditoria } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { projetarDemanda12Meses, projetarOpex12Meses } from '../planejamento-estrategico/planejamento-estrategico.calculations';
import type { MesValor as MesValorStrategico } from '../planejamento-estrategico/planejamento-estrategico.calculations';
import {
  calcCenarioPessoal,
  calcHeadcountOtimo,
  calcOrcamentoAnualPessoal,
  calcProjecaoContratacao,
  extrairCustoMensalPessoalProxy,
  linhaMatrizTurno,
} from './planejamento-pessoal.calculations';
import { TurnoPlanejamentoPessoal } from './planejamento-pessoal.turno';
import type {
  PlanejamentoCenarioPessoalQueryDto,
  PlanejamentoContratacaoQueryDto,
  PlanejamentoHeadcountOtimoQueryDto,
  PlanejamentoOrcamentoAnualQueryDto,
} from './dto/planejamento-pessoal-query.dto';
import type {
  PlanejamentoCenarioPessoalRespostaDto,
  PlanejamentoContratacaoRespostaDto,
  PlanejamentoHeadcountOtimoRespostaDto,
  PlanejamentoMatrizTurnosRespostaDto,
  PlanejamentoOrcamentoAnualRespostaDto,
} from './dto/planejamento-pessoal-response.dto';

const OP_TABLES = ['portarias', 'gates', 'patios', 'saidas'] as const;

function parseDemanda12Csv(raw: string): number[] | null {
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length !== 12) return null;
  const vals = parts.map((p) => Number(p));
  if (vals.some((v) => !Number.isFinite(v) || v < 0)) return null;
  return vals;
}

@Injectable()
export class PlanejamentoPessoalService {
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

  private saturacaoTurnoLimiarPct(): number {
    const v = parseFloat(this.config.get<string>('PLANEJAMENTO_SATURACAO_TURNO_LIMIAR') ?? '88');
    return Number.isFinite(v) && v > 0 ? Math.min(100, v) : 88;
  }

  /** Demanda projetada 12 meses (mesma base que planejamento estratégico). */
  private async demanda12MesesProjecao(): Promise<MesValorStrategico[]> {
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

    const historico: MesValorStrategico[] = rows.map((r) => ({
      mes: r.mes,
      valor: Number(r.n),
    }));

    return projetarDemanda12Meses(historico).volumePrevisto;
  }

  private async coletarOpexBaseInterno(): Promise<{
    custoMensalPrevisto: MesValorStrategico[];
    cicloMinutos: number;
    usuariosDistintos: number;
    ocupacaoPct: number;
  }> {
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

    const cicloMin =
      cicloRows[0]?.m !== null && cicloRows[0]?.m !== undefined ? Number(cicloRows[0].m) : 240;
    const custoPorOp = cicloMin * 60 * this.custoMinutoProxy();

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

    return {
      custoMensalPrevisto: opex.custoMensalPrevisto,
      cicloMinutos: cicloMin,
      usuariosDistintos: usuarios.length,
      ocupacaoPct,
    };
  }

  /** Agrega auditoria por turno (hora UTC do servidor). */
  private async metricasPorTurno(dias: number): Promise<
    Record<
      TurnoPlanejamentoPessoal,
      { ops: number; usuarios: number }
    >
  > {
    const ini = new Date();
    ini.setDate(ini.getDate() - dias);
    ini.setHours(0, 0, 0, 0);

    const acaoInsert = AcaoAuditoria.INSERT;
    const rows = await this.prisma.$queryRaw<Array<{ turno: string; ops: bigint; usuarios: bigint }>>`
      WITH base AS (
        SELECT
          CASE
            WHEN EXTRACT(HOUR FROM a."createdAt") >= 6 AND EXTRACT(HOUR FROM a."createdAt") < 13 THEN 'MANHA'
            WHEN EXTRACT(HOUR FROM a."createdAt") >= 13 AND EXTRACT(HOUR FROM a."createdAt") < 21 THEN 'TARDE'
            ELSE 'NOITE'
          END AS turno,
          a.usuario
        FROM auditorias a
        WHERE a."createdAt" >= ${ini}
          AND a.acao = ${acaoInsert}
          AND a.tabela IN ('portarias', 'gates', 'patios', 'saidas')
      )
      SELECT turno, COUNT(*)::bigint AS ops, COUNT(DISTINCT usuario)::bigint AS usuarios
      FROM base
      GROUP BY turno
    `;

    const base: Record<TurnoPlanejamentoPessoal, { ops: number; usuarios: number }> = {
      [TurnoPlanejamentoPessoal.MANHA]: { ops: 0, usuarios: 0 },
      [TurnoPlanejamentoPessoal.TARDE]: { ops: 0, usuarios: 0 },
      [TurnoPlanejamentoPessoal.NOITE]: { ops: 0, usuarios: 0 },
    };

    for (const r of rows) {
      const t = r.turno as TurnoPlanejamentoPessoal;
      if (t in base) {
        base[t] = { ops: Number(r.ops), usuarios: Number(r.usuarios) };
      }
    }

    return base;
  }

  private produtividadePorOperadorDia(
    turno: TurnoPlanejamentoPessoal,
    m: Record<TurnoPlanejamentoPessoal, { ops: number; usuarios: number }>,
    dias: number,
  ): number {
    const row = m[turno];
    const diasRef = Math.max(1, dias);
    if (row.usuarios <= 0 || row.ops <= 0) {
      const fallback =
        parseFloat(this.config.get<string>('PLANEJAMENTO_PESSOAL_PROD_OP_DIA_FALLBACK') ?? '12') || 12;
      return fallback;
    }
    return Math.round((row.ops / row.usuarios / diasRef) * 1000) / 1000;
  }

  async getHeadcountOtimo(
    query: PlanejamentoHeadcountOtimoQueryDto,
  ): Promise<PlanejamentoHeadcountOtimoRespostaDto> {
    const dias = 90;
    const porTurno = await this.metricasPorTurno(dias);
    const prod =
      query.produtividadeHistorica !== undefined && query.produtividadeHistorica !== null
        ? query.produtividadeHistorica
        : this.produtividadePorOperadorDia(query.turno, porTurno, dias);

    const atual = Math.max(1, porTurno[query.turno]?.usuarios ?? 1);

    const r = calcHeadcountOtimo({
      demandaPrevistaDia: query.demandaPrevista,
      produtividadePorOperadorDia: prod,
      headcountAtual: atual,
    });

    return {
      turno: query.turno,
      demandaPrevistaDia: query.demandaPrevista,
      produtividadePorOperadorDia: prod,
      headcountAtualProxy: atual,
      headcountRecomendado: r.headcountRecomendado,
      deficitOuExcessoAtual: r.deficitOuExcessoAtual,
      tipoSaldo: r.tipoSaldo,
      produtividadeEstimadaEquipeRecomendada: r.produtividadeEstimadaEquipeRecomendada,
      riscoOperacionalPct: r.riscoOperacionalPct,
    };
  }

  async getOrcamentoAnual(
    query: PlanejamentoOrcamentoAnualQueryDto,
  ): Promise<PlanejamentoOrcamentoAnualRespostaDto> {
    const coef = query.coeficienteEncargos ?? 1.78;
    const he = query.custoHoraExtraProxyPct ?? 8;
    const share =
      query.sharePessoalNoOpex ??
      parseFloat(this.config.get<string>('PLANEJAMENTO_PESSOAL_SHARE_OPEX') ?? '0.52');

    const base = await this.coletarOpexBaseInterno();
    const mensalPessoal = extrairCustoMensalPessoalProxy(base.custoMensalPrevisto, share);

    const out = calcOrcamentoAnualPessoal({
      custoMensalBasePessoal: mensalPessoal,
      coeficienteEncargos: coef,
      custoHoraExtraProxyPct: he,
    });

    const premissas =
      'OPEX de pessoal: parcela configurável do OPEX projetado (proxy estratégico) × encargos × proxy HE; não altera dados operacionais.';

    return {
      custoMensal: out.custoMensal.map((x) => ({ mes: x.mes, valor: x.valor })),
      custoAnualPrevisto: out.custoAnualPrevisto,
      deltaMesAMesPct: out.deltaMesAMesPct,
      coeficienteEncargosAplicado: coef,
      custoHoraExtraProxyPctAplicado: he,
      premissasResumo: premissas,
    };
  }

  async getCenarioPessoal(
    query: PlanejamentoCenarioPessoalQueryDto,
  ): Promise<PlanejamentoCenarioPessoalRespostaDto> {
    const contratar = query.contratar ?? 0;
    const demitir = query.demitir ?? 0;
    const volume = query.volumeEstimadoNovoCliente ?? 0;

    const demanda = await this.demanda12MesesProjecao();
    const capBase =
      demanda.reduce((s, x) => s + x.valor, 0) / Math.max(1, demanda.length);

    const base = await this.coletarOpexBaseInterno();
    const custoHoraProxy =
      base.cicloMinutos * this.custoMinutoProxy();

    const r = calcCenarioPessoal({
      contratar,
      demitir,
      volumeEstimadoNovoClienteMes: volume,
      capacidadeBaseUnidadesMes: Math.max(1, capBase),
      cicloMedioMinutosBase: base.cicloMinutos,
      custoPorOperadorHoraProxy: Math.max(0.01, custoHoraProxy),
      headcountProximoBase: Math.max(3, Math.ceil(base.usuariosDistintos * 0.92)),
    });

    let treino = r.requisitoTreinamentoHoras;
    let obs: string | undefined;
    if (
      query.moverDeTurno &&
      query.moverParaTurno &&
      query.moverDeTurno !== query.moverParaTurno
    ) {
      treino += 16;
      obs = `Movimentação entre ${query.moverDeTurno} e ${query.moverParaTurno}: inclui ~16h de reciclagem de turno no proxy de treinamento.`;
    }

    return {
      impactoCapacidadeUnidadesMesPct: r.impactoCapacidadeUnidadesMesPct,
      impactoCicloMinutos: r.impactoCicloMinutos,
      impactoCustoPorHoraPct: r.impactoCustoPorHoraPct,
      requisitoTreinamentoHoras: Math.round(treino * 10) / 10,
      observacaoMovimentacaoTurnos: obs,
    };
  }

  async getMatrizTurnos(): Promise<PlanejamentoMatrizTurnosRespostaDto> {
    const dias = 90;
    const porTurno = await this.metricasPorTurno(dias);
    const demanda = await this.demanda12MesesProjecao();
    const capMes = Math.max(
      500,
      demanda.reduce((s, x) => s + x.valor, 0) / Math.max(1, demanda.length),
    );

    const custoOpMes =
      parseFloat(this.config.get<string>('PLANEJAMENTO_OPEX_OPERADOR_MES') ?? '8500') || 8500;

    const limiar = this.saturacaoTurnoLimiarPct();
    const turnos = [TurnoPlanejamentoPessoal.MANHA, TurnoPlanejamentoPessoal.TARDE, TurnoPlanejamentoPessoal.NOITE].map(
      (t) => {
        const row = porTurno[t];
        const linha = linhaMatrizTurno({
          turno: t,
          operacoesPeriodo: row.ops,
          usuariosDistintos: Math.max(1, row.usuarios),
          diasPeriodo: dias,
          custoOperadorMesProxy: custoOpMes,
          capacidadeReferenciaMesUnidades: capMes,
        });
        return {
          ...linha,
          pontoSaturacaoTurnoPct: limiar,
        };
      },
    );

    return {
      turnos,
      diasReferencia: dias,
      capacidadeReferenciaMesUnidades: Math.round(capMes * 100) / 100,
    };
  }

  async getContratacao(
    query: PlanejamentoContratacaoQueryDto,
  ): Promise<PlanejamentoContratacaoRespostaDto> {
    const demandaProj = await this.demanda12MesesProjecao();

    let demanda12: number[];
    if (query.demanda12Meses?.trim()) {
      const parsed = parseDemanda12Csv(query.demanda12Meses.trim());
      if (!parsed) {
        demanda12 = demandaProj.map((x) => x.valor);
      } else {
        demanda12 = parsed;
      }
    } else {
      demanda12 = demandaProj.map((x) => x.valor);
    }

    const dias = 90;
    const usuTotal = await this.prisma.auditoria.groupBy({
      by: ['usuario'],
      where: {
        createdAt: { gte: new Date(Date.now() - dias * 86400000) },
        acao: AcaoAuditoria.INSERT,
        tabela: { in: [...OP_TABLES] },
      },
      _count: { id: true },
    });

    const demandaAnual = demanda12.reduce((s, x) => s + x, 0);
    const prodDefault =
      usuTotal.length > 0 && demandaAnual > 0
        ? demandaAnual / Math.max(1, usuTotal.length) / 12
        : parseFloat(this.config.get<string>('PLANEJAMENTO_PESSOAL_PROD_OP_MES_FALLBACK') ?? '380') || 380;

    const prod =
      query.produtividadePorOperadorMes !== undefined && query.produtividadePorOperadorMes !== null
        ? query.produtividadePorOperadorMes
        : Math.round(prodDefault * 100) / 100;

    const hc =
      query.headcountAtual !== undefined && query.headcountAtual !== null
        ? query.headcountAtual
        : Math.max(3, usuTotal.length);

    const custoAdmissao =
      parseFloat(this.config.get<string>('PLANEJAMENTO_PESSOAL_CUSTO_ADMISSAO_PROXY') ?? '4200') || 4200;
    const margemOp =
      parseFloat(this.config.get<string>('PLANEJAMENTO_PESSOAL_MARGEM_OP_MES_PROXY') ?? '2100') || 2100;

    const r = calcProjecaoContratacao({
      demanda12Meses: demanda12,
      produtividadePorOperadorMes: prod,
      headcountAtual: hc,
      custoContratacaoPorHeadProxy: custoAdmissao,
      margemPorOperadorMesProxy: margemOp,
    });

    const demandaMensalReferencia = demanda12.map((valor, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() + i + 1, 1);
      const mesStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return { mes: mesStr, valor };
    });

    return {
      demandaMensalReferencia,
      produtividadePorOperadorMes: prod,
      headcountAtual: hc,
      previsaoContratar: r.previsaoContratar,
      previsaoTreinarHoras: r.previsaoTreinarHoras,
      riscoTurnoverPct: r.riscoTurnoverPct,
      roiContratacaoProxy: r.roiContratacaoProxy,
    };
  }
}
