import { BadRequestException, Injectable } from '@nestjs/common';
import { AcaoAuditoria, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  hotspotsPatio,
  metricasConfianca,
  previsaoCicloMinutos,
  previsoesGargaloPorHorizontes,
  recomendarBalanceamentoPatio,
  sazonaliadePorDispersao,
  SerieEtapaMinutos,
  tendenciaTemporal,
} from './ia-operacional.calculations';
import { pipelineOcrGateMock } from './ia-operacional.ocr-mock';
import type { IaCicloPrevistoQueryDto, IaProdutividadeOperadorQueryDto } from './dto/ia-query.dto';
import type {
  IaCicloPrevistoRespostaDto,
  IaGargalosRespostaDto,
  IaOcrGateRespostaDto,
  IaPatioRecomendacoesRespostaDto,
  IaProdutividadeOperadorRespostaDto,
} from './dto/ia-response.dto';
import { TurnoIa } from './dto/ia-turno.enum';

const OP_TABLES = ['portarias', 'gates', 'patios', 'saidas'] as const;

/** Picos típicos locais (hora 0–23): multiplicador sobre ciclo médio. */
function fatorHorarioChegada(hora: number): number {
  if (hora >= 8 && hora <= 11) return 1.12;
  if (hora >= 13 && hora <= 16) return 1.08;
  if (hora >= 22 || hora <= 4) return 0.94;
  return 1;
}

function horaLocal(d: Date): number {
  return d.getHours();
}

function horaNoTurnoLocal(h: number, turno: TurnoIa): boolean {
  if (turno === TurnoIa.MANHA) return h >= 6 && h < 14;
  if (turno === TurnoIa.TARDE) return h >= 14 && h < 22;
  return h >= 22 || h < 6;
}

function duracaoTurnoHoras(turno: TurnoIa): number {
  void turno;
  return 8;
}

@Injectable()
export class IaOperacionalService {
  constructor(private readonly prisma: PrismaService) {}

  /** Séries de tempos por etapa (histórico recente). */
  private async carregarSeriesEtapaMinutos(dias = 120): Promise<{
    series: SerieEtapaMinutos;
    amostrasCompletas: number;
    cicloTotalMinutos: number[];
  }> {
    const fim = new Date();
    const ini = new Date(fim);
    ini.setDate(ini.getDate() - dias);

    const rows = await this.prisma.$queryRaw<
      Array<{ mp: unknown; mg: unknown; myard: unknown; tot: unknown }>
    >`
      SELECT DISTINCT ON (s.id)
        EXTRACT(EPOCH FROM (g."createdAt" - po."createdAt")) / 60.0 AS mp,
        EXTRACT(EPOCH FROM (pt."createdAt" - g."createdAt")) / 60.0 AS mg,
        EXTRACT(EPOCH FROM (sa."dataHoraSaida" - pt."createdAt")) / 60.0 AS myard,
        EXTRACT(EPOCH FROM (sa."dataHoraSaida" - po."createdAt")) / 60.0 AS tot
      FROM solicitacoes s
      JOIN portarias po ON po."solicitacaoId" = s.id
      JOIN gates g ON g."solicitacaoId" = s.id
      JOIN patios pt ON pt."solicitacaoId" = s.id
      JOIN saidas sa ON sa."solicitacaoId" = s.id
      JOIN unidades_solicitacao u ON u."solicitacaoId" = s.id
      WHERE s."deletedAt" IS NULL
        AND sa."dataHoraSaida" >= ${ini}
        AND sa."dataHoraSaida" <= ${fim}
        AND EXTRACT(EPOCH FROM (g."createdAt" - po."createdAt")) >= 0
        AND EXTRACT(EPOCH FROM (pt."createdAt" - g."createdAt")) >= 0
        AND EXTRACT(EPOCH FROM (sa."dataHoraSaida" - pt."createdAt")) >= 0
      ORDER BY s.id
    `;

    const series: SerieEtapaMinutos = {
      portaria: [],
      gate: [],
      patio: [],
      saida: [],
    };
    const cicloTotalMinutos: number[] = [];

    for (const r of rows) {
      const myard = Number(r.myard);
      const mp = Number(r.mp);
      const mg = Number(r.mg);
      const tot = Number(r.tot);
      if (!Number.isFinite(myard) || !Number.isFinite(mp) || !Number.isFinite(mg)) continue;
      series.portaria.push(mp);
      series.gate.push(mg);
      series.patio.push(Math.min(240, myard * 0.72));
      series.saida.push(Math.max(0.25, myard * 0.28));
      if (Number.isFinite(tot)) cicloTotalMinutos.push(tot);
    }

    return { series, amostrasCompletas: rows.length, cicloTotalMinutos };
  }

  async getGargalos(): Promise<IaGargalosRespostaDto> {
    const { series, amostrasCompletas } = await this.carregarSeriesEtapaMinutos(120);
    const horizontes = previsoesGargaloPorHorizontes(series);
    const agregado = [
      ...series.portaria,
      ...series.gate,
      ...series.patio,
      ...series.saida,
    ];
    const tendencia = tendenciaTemporal(
      agregado.length >= 8 ? agregado.slice(-Math.min(200, agregado.length)) : agregado,
    );
    const sazonaliade = sazonaliadePorDispersao(series.patio.length ? series.patio : series.portaria);
    const metricas = metricasConfianca(amostrasCompletas);

    return {
      horizontes,
      metricasConfianca: metricas,
      tendencia,
      sazonaliade,
      amostrasCompletas,
    };
  }

  processarImagemOcr(buffer: Buffer): IaOcrGateRespostaDto {
    return pipelineOcrGateMock(buffer);
  }

  async getCicloPrevisto(query: IaCicloPrevistoQueryDto): Promise<IaCicloPrevistoRespostaDto> {
    const chegada = new Date(query.horarioChegada);
    const fator = fatorHorarioChegada(horaLocal(chegada));

    const ini = new Date();
    ini.setDate(ini.getDate() - 180);

    const clienteFilter = query.clienteId
      ? Prisma.sql`AND s."clienteId" = ${query.clienteId}`
      : Prisma.empty;

    const tipoCond = Prisma.sql`u.tipo = ${query.tipoUnidade}::"TipoUnidade"`;

    const rows = await this.prisma.$queryRaw<Array<{ tot: unknown }>>`
      SELECT DISTINCT ON (s.id)
        EXTRACT(EPOCH FROM (sa."dataHoraSaida" - po."createdAt")) / 60.0 AS tot
      FROM solicitacoes s
      JOIN portarias po ON po."solicitacaoId" = s.id
      JOIN gates g ON g."solicitacaoId" = s.id
      JOIN patios pt ON pt."solicitacaoId" = s.id
      JOIN saidas sa ON sa."solicitacaoId" = s.id
      JOIN unidades_solicitacao u ON u."solicitacaoId" = s.id
      WHERE s."deletedAt" IS NULL
        AND sa."dataHoraSaida" >= ${ini}
        AND ${tipoCond}
        ${clienteFilter}
      ORDER BY s.id
    `;

    const amostras = rows.map((r) => Number(r.tot)).filter((x) => Number.isFinite(x) && x > 0);
    const base = previsaoCicloMinutos(amostras);
    const prev = Math.round(base.previstoMinutos * fator * 10) / 10;
    const bi = Math.round(base.bandaInferiorMinutos * Math.min(fator, 1.15));
    const bs = Math.round(base.bandaSuperiorMinutos * Math.max(fator, 0.92));

    return {
      previstoMinutos: prev,
      desvioPadraoMinutos: base.desvioPadraoMinutos,
      bandaInferiorMinutos: bi,
      bandaSuperiorMinutos: bs,
      fatorHorarioChegada: fator,
      amostrasConsideradas: amostras.length,
    };
  }

  async getPatioRecomendacoes(): Promise<IaPatioRecomendacoesRespostaDto> {
    const grouped = await this.prisma.patio.groupBy({
      by: ['quadra'],
      _count: { id: true },
    });

    const ocupacaoPorQuadra: Record<string, number> = {};
    for (const g of grouped) {
      ocupacaoPorQuadra[g.quadra] = g._count.id;
    }

    const total = Object.values(ocupacaoPorQuadra).reduce((a, b) => a + b, 0);
    const caps: Record<string, number> = {};
    const maxOcc = Math.max(...Object.values(ocupacaoPorQuadra), 1);
    for (const q of Object.keys(ocupacaoPorQuadra)) {
      caps[q] = Math.max(10, Math.ceil(maxOcc * 1.35));
    }

    const hotspots = hotspotsPatio(ocupacaoPorQuadra, caps);
    const recomendacoes = recomendarBalanceamentoPatio(ocupacaoPorQuadra, caps);

    return {
      ocupacaoTotalSlots: total,
      hotspots,
      recomendacoes,
    };
  }

  /**
   * Ciclo médio a partir da mesma base estatística do módulo IA operacional (amostras com fluxo completo).
   * Usado pelo Datahub BI como “ciclo via IA” em contraste ao proxy simples por datas da solicitação.
   */
  async resumoCicloMedioParaDatahub(): Promise<{
    minutosMedio: number;
    diasMedioEquivalente: number;
    amostrasCompletas: number;
  }> {
    const { cicloTotalMinutos, amostrasCompletas } = await this.carregarSeriesEtapaMinutos(120);
    if (!cicloTotalMinutos.length) {
      return { minutosMedio: 0, diasMedioEquivalente: 0, amostrasCompletas };
    }
    const sum = cicloTotalMinutos.reduce((a, b) => a + b, 0);
    const minutosMedio = Math.round((sum / cicloTotalMinutos.length) * 100) / 100;
    return {
      minutosMedio,
      diasMedioEquivalente: Math.round((minutosMedio / 1440) * 100) / 100,
      amostrasCompletas,
    };
  }

  async getProdutividadeOperador(
    query: IaProdutividadeOperadorQueryDto,
  ): Promise<IaProdutividadeOperadorRespostaDto> {
    const ini = new Date();
    ini.setDate(ini.getDate() - 21);

    const rows = await this.prisma.auditoria.findMany({
      where: {
        createdAt: { gte: ini },
        acao: AcaoAuditoria.INSERT,
        tabela: { in: [...OP_TABLES] },
        ...(query.operadorId ? { usuario: query.operadorId } : {}),
      },
      select: { usuario: true, createdAt: true },
    });

    const filtrados = rows.filter((r) =>
      horaNoTurnoLocal(r.createdAt.getHours(), query.turno),
    );

    const horasTurno = duracaoTurnoHoras(query.turno);
    const dias = 21;
    const horasTotal = horasTurno * dias;
    const taxa = filtrados.length / Math.max(1, horasTotal);

    const porUsuario = new Map<string, number>();
    for (const r of filtrados) {
      porUsuario.set(r.usuario, (porUsuario.get(r.usuario) ?? 0) + 1);
    }
    const vals = [...porUsuario.values()];
    const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    const variance =
      vals.length > 1
        ? vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length
        : 0;
    const std = Math.sqrt(variance);
    let outliers = 0;
    for (const v of vals) {
      if (v > mean + 2 * std && std > 0) outliers++;
    }

    const { series } = await this.carregarSeriesEtapaMinutos(60);
    const me = [
      { k: 'Portaria', v: media(series.portaria) },
      { k: 'Gate', v: media(series.gate) },
      { k: 'Pátio', v: media(series.patio) },
      { k: 'Saída', v: media(series.saida) },
    ].sort((a, b) => b.v - a.v);
    const gargaloDominantePorTurno = me[0]?.k ?? '—';

    return {
      turno: query.turno,
      operadorId: query.operadorId ?? null,
      produtividadePrevistaOpsHora: Math.round(taxa * 1000) / 1000,
      gargaloDominantePorTurno,
      outliersDetectados: outliers,
      eventosHistoricosNoTurno: filtrados.length,
    };
  }

  static decodeBase64ParaBuffer(imagemBase64: string): Buffer {
    let raw = imagemBase64.trim();
    const dataUrl = /^data:[^;]+;base64,(.+)$/i.exec(raw);
    if (dataUrl) raw = dataUrl[1];
    try {
      return Buffer.from(raw, 'base64');
    } catch {
      throw new BadRequestException('imagemBase64 inválida');
    }
  }
}

function media(xs: number[]): number {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
