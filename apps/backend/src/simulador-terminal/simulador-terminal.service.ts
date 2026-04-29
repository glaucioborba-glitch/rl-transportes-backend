import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AcaoAuditoria } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  expansaoRoiOperacionalProxy,
  fatorSaturacao,
  projetarSeriesPorHorizonte,
  simularCenarioWhatIf,
  simularEfeitoTurnos,
  type HorizonteProjecaoDias,
} from './simulador-terminal.calculations';
import type {
  SimuladorCenarioQueryDto,
  SimuladorExpansaoQueryDto,
  SimuladorProjecaoQueryDto,
  SimuladorTurnosQueryDto,
} from './dto/simulador-terminal-query.dto';
import type {
  SimuladorCapacidadeRespostaDto,
  SimuladorCenarioRespostaDto,
  SimuladorExpansaoRespostaDto,
  SimuladorProjecaoItemDto,
  SimuladorProjecaoRespostaDto,
  SimuladorTurnosRespostaDto,
} from './dto/simulador-terminal-response.dto';

const OP_TABLES = ['portarias', 'gates', 'patios', 'saidas'] as const;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function media(xs: number[]): number {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

@Injectable()
export class SimuladorTerminalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private capacidadePatioSlotsTotal(): number {
    const v = parseInt(
      this.config.get<string>('PERFORMANCE_PATIO_CAPACIDADE_ESTIMADA') ??
        this.config.get<string>('SIMULADOR_SLOTS_CAPACIDADE_TOTAL') ??
        '200',
      10,
    );
    return Number.isFinite(v) && v > 0 ? v : 200;
  }

  private custoExpansaoM2Proxy(): number {
    const v = parseFloat(this.config.get<string>('SIMULADOR_CUSTO_EXPANSAO_M2_PROXY') ?? '850');
    return Number.isFinite(v) && v > 0 ? v : 850;
  }

  private margemSlotProxy(): number {
    const v = parseFloat(this.config.get<string>('SIMULADOR_MARGEM_OPER_SLOT_PROXY') ?? '120');
    return Number.isFinite(v) && v > 0 ? v : 120;
  }

  private m2PorSlotProxy(): number {
    const v = parseFloat(this.config.get<string>('SIMULADOR_M2_POR_SLOT_PROXY') ?? '36');
    return Number.isFinite(v) && v > 0 ? v : 36;
  }

  async getCapacidadeAtual(): Promise<SimuladorCapacidadeRespostaDto> {
    const periodoDias = 30;
    const fim = new Date();
    const ini = new Date(fim);
    ini.setDate(ini.getDate() - periodoDias);
    ini.setHours(0, 0, 0, 0);
    fim.setHours(23, 59, 59, 999);

    const horasPeriodo = Math.max(1 / 60, (fim.getTime() - ini.getTime()) / 3_600_000);

    const capSlots = this.capacidadePatioSlotsTotal();
    const ocupacaoAtual = await this.prisma.patio.count();

    const [gatesT, portariasT, grupoQuadra, cicloRows] = await Promise.all([
      this.prisma.gate.count({
        where: {
          createdAt: { gte: ini, lte: fim },
          solicitacao: { deletedAt: null },
        },
      }),
      this.prisma.portaria.count({
        where: {
          createdAt: { gte: ini, lte: fim },
          solicitacao: { deletedAt: null },
        },
      }),
      this.prisma.patio.groupBy({
        by: ['quadra'],
        _count: { id: true },
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
          AND sa."dataHoraSaida" <= ${fim}
      `,
    ]);

    const gateMediaUph = round2(gatesT / horasPeriodo);
    const portMediaUph = round2(portariasT / horasPeriodo);

    const [gatePicoRows, portPicoRows] = await Promise.all([
      this.prisma.$queryRaw<Array<{ c: bigint }>>`
        SELECT COUNT(*)::bigint AS c
        FROM gates g
        JOIN solicitacoes s ON s.id = g."solicitacaoId"
        WHERE s."deletedAt" IS NULL AND g."createdAt" >= ${ini} AND g."createdAt" <= ${fim}
        GROUP BY DATE_TRUNC('hour', g."createdAt")
        ORDER BY COUNT(*) DESC
        LIMIT 1
      `,
      this.prisma.$queryRaw<Array<{ c: bigint }>>`
        SELECT COUNT(*)::bigint AS c
        FROM portarias po
        JOIN solicitacoes s ON s.id = po."solicitacaoId"
        WHERE s."deletedAt" IS NULL AND po."createdAt" >= ${ini} AND po."createdAt" <= ${fim}
        GROUP BY DATE_TRUNC('hour', po."createdAt")
        ORDER BY COUNT(*) DESC
        LIMIT 1
      `,
    ]);

    const gatePico = gatePicoRows[0]?.c ? Number(gatePicoRows[0].c) : gateMediaUph;
    const portPico = portPicoRows[0]?.c ? Number(portPicoRows[0].c) : portMediaUph;

    const quadraVals = grupoQuadra.map((g) => g._count.id);
    const quadrasDistintas = grupoQuadra.length || 1;
    const slotsPorQuadraEstimado = Math.max(
      10,
      Math.ceil(capSlots / Math.max(1, quadrasDistintas)),
      quadraVals.length ? Math.ceil(media(quadraVals)) : 40,
    );

    const cicloRaw = cicloRows[0]?.m;
    const cicloMedioMinutos =
      cicloRaw !== null && cicloRaw !== undefined ? round2(Number(cicloRaw)) : null;

    return {
      capacidadePatioSlotsTotal: capSlots,
      ocupacaoAtualUnidades: ocupacaoAtual,
      fatorSaturacaoPct: round2(fatorSaturacao(ocupacaoAtual, capSlots)),
      capacidadeGateUnidadesPorHoraMedia: gateMediaUph,
      capacidadeGateUnidadesPorHoraPico: round2(gatePico),
      capacidadePortariaUnidadesPorHoraMedia: portMediaUph,
      capacidadePortariaUnidadesPorHoraPico: round2(portPico),
      cicloMedioMinutos,
      quadrasDistintas,
      slotsPorQuadraEstimado,
      periodoReferenciaDias: periodoDias,
    };
  }

  async getProjecaoSaturacao(
    query: SimuladorProjecaoQueryDto,
  ): Promise<SimuladorProjecaoRespostaDto> {
    const cap = await this.getCapacidadeAtual();
    const fim = new Date();
    const ini = new Date(fim);
    ini.setDate(ini.getDate() - 90);
    ini.setHours(0, 0, 0, 0);

    const dailyRows = await this.prisma.$queryRaw<Array<{ d: Date; n: bigint }>>`
      SELECT DATE(sa."dataHoraSaida") AS d, COUNT(*)::bigint AS n
      FROM saidas sa
      JOIN solicitacoes s ON s.id = sa."solicitacaoId"
      WHERE s."deletedAt" IS NULL
        AND sa."dataHoraSaida" >= ${ini}
        AND sa."dataHoraSaida" <= ${fim}
      GROUP BY 1
      ORDER BY 1
    `;

    const demandaDiaria = dailyRows.map((r) => Number(r.n));

    const horizontes: HorizonteProjecaoDias[] = query.horizonteDias
      ? [query.horizonteDias]
      : [7, 14, 30];

    const projecoes: SimuladorProjecaoItemDto[] = horizontes.map((h) => {
      const p = projetarSeriesPorHorizonte(
        demandaDiaria,
        cap.fatorSaturacaoPct,
        cap.capacidadeGateUnidadesPorHoraMedia,
        cap.capacidadePortariaUnidadesPorHoraMedia,
        h,
      );
      return {
        dias: h,
        saturacaoPatioPrevistaPct: p.saturacaoPatioPrevistaPct,
        demandaPortariaPrevistaUph: p.demandaPortariaPrevistaUph,
        throughputGatePrevistoUph: p.throughputGatePrevistoUph,
        confiancaPct: p.confiancaPct,
      };
    });

    return {
      projecoes,
      saturacaoAtualPct: cap.fatorSaturacaoPct,
    };
  }

  async getCenarioWhatIf(query: SimuladorCenarioQueryDto): Promise<SimuladorCenarioRespostaDto> {
    const base = await this.getCapacidadeAtual();
    const q = {
      aumentoDemandaPercentual: query.aumentoDemandaPercentual ?? 0,
      reducaoTurnoHoras: query.reducaoTurnoHoras ?? 0,
      aumentoTurnoHoras: query.aumentoTurnoHoras ?? 0,
      expansaoQuadras: query.expansaoQuadras ?? 0,
      novoClienteVolumeEstimado: query.novoClienteVolumeEstimado ?? 0,
    };

    const sim = simularCenarioWhatIf({
      ...q,
      slotsPorQuadra: base.slotsPorQuadraEstimado,
      capacidadeTotalSlots: base.capacidadePatioSlotsTotal,
      ocupacaoAtualUnidades: base.ocupacaoAtualUnidades,
      throughputGateBaseUph: base.capacidadeGateUnidadesPorHoraMedia,
      cicloMedioMinutosBase: base.cicloMedioMinutos ?? 240,
    });

    return {
      impactoNaSaturacaoPctPontos: sim.impactoNaSaturacaoPctPontos,
      saturacaoResultantePct: sim.saturacaoResultantePct,
      impactoNoCicloMinutos: sim.impactoNoCicloMinutos,
      cicloResultanteMinutos: sim.cicloResultanteMinutos,
      necessidadeExpansaoSlots: sim.necessidadeExpansaoSlots,
      necessidadeExpansaoM2Estimada: sim.necessidadeExpansaoM2Estimada,
      throughputEsperadoUph: sim.throughputEsperadoUph,
      gargalosProvaveis: sim.gargalosProvaveis,
    };
  }

  async getExpansao(query: SimuladorExpansaoQueryDto): Promise<SimuladorExpansaoRespostaDto> {
    const base = await this.getCapacidadeAtual();
    const quadrasAdd = query.quadrasAdicionais ?? 1;
    const slotsPQ =
      query.slotsPorQuadraEstimado ?? Math.max(10, Math.round(base.slotsPorQuadraEstimado));

    const r = expansaoRoiOperacionalProxy({
      quadrasAdicionais: quadrasAdd,
      slotsPorQuadra: slotsPQ,
      ocupacaoAtualUnidades: base.ocupacaoAtualUnidades,
      capacidadeTotalSlotsAtual: base.capacidadePatioSlotsTotal,
      custoExpansaoPorM2Proxy: this.custoExpansaoM2Proxy(),
      margemOperacionalPorSlotProxy: this.margemSlotProxy(),
      m2PorSlotProxy: this.m2PorSlotProxy(),
    });

    return {
      ganhoSlots: r.ganhoSlots,
      novaCapacidadeTotalSlots: r.novaCapacidadeTotalSlots,
      saturacaoAtualPct: r.saturacaoAtualPct,
      saturacaoAposExpansaoPct: r.saturacaoAposExpansaoPct,
      reducaoSaturacaoPctPontos: r.reducaoSaturacaoPctPontos,
      impactoCicloMinutosEstimado: r.impactoCicloMinutosEstimado,
      roiOperacionalProxy: r.roiOperacionalProxy,
      mesesPaybackProxy: r.mesesPaybackProxy,
    };
  }

  async getTurnos(query: SimuladorTurnosQueryDto): Promise<SimuladorTurnosRespostaDto> {
    const ini = new Date();
    ini.setDate(ini.getDate() - 21);

    const rows = await this.prisma.auditoria.findMany({
      where: {
        createdAt: { gte: ini },
        acao: AcaoAuditoria.INSERT,
        tabela: { in: [...OP_TABLES] },
      },
      select: { createdAt: true },
    });

    function bucket(h: number): 'MANHA' | 'TARDE' | 'NOITE' {
      if (h >= 6 && h < 14) return 'MANHA';
      if (h >= 14 && h < 22) return 'TARDE';
      return 'NOITE';
    }

    const porTurnoKeys = ['MANHA', 'TARDE', 'NOITE'] as const;
    const horasTurno = { MANHA: 8, TARDE: 8, NOITE: 8 };
    const counts: Record<string, number> = { MANHA: 0, TARDE: 0, NOITE: 0 };

    for (const r of rows) {
      counts[bucket(r.createdAt.getHours())]++;
    }

    const porTurno = porTurnoKeys.map((t) => ({
      turno: t,
      produtividadeRelativaUph: round2(counts[t] / Math.max(1, horasTurno[t] * 21)),
    }));

    const prodMap = Object.fromEntries(porTurno.map((x) => [x.turno, x.produtividadeRelativaUph]));

    const fx = simularEfeitoTurnos(
      prodMap,
      query.reducaoTurno ?? null,
      query.aumentoTurno ?? null,
    );

    return {
      porTurno,
      produtividadeMediaGlobal: round2(fx.baseline),
      produtividadeAjustadaProxy: round2(fx.ajustado),
      deltaProdutividadePct: fx.deltaPct,
    };
  }
}
