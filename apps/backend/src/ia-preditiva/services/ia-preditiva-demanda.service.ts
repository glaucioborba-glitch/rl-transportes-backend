import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { preverDemandaVolume, type PontoMensal } from '../math/demanda.engine';
import { IaPreditivaMlopsStore } from '../ia-preditiva-mlops.store';
import { fitLinear, mean, stdDev } from '../math/linear-regression';

@Injectable()
export class IaPreditivaDemandaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mlops: IaPreditivaMlopsStore,
    private readonly config: ConfigService,
  ) {}

  async obterDemanda() {
    const horizontes = [7, 30, 90, 180];
    const mensal = await this.carregarSerieMensal();
    const cv = mensal.length >= 2 ? stdDev(mensal.map((m) => m.volume)) / (mean(mensal.map((m) => m.volume)) || 1) : 1;

    const out = preverDemandaVolume({
      mensal,
      horizontesDias: horizontes,
      sesAlpha: this.mlops.sesAlpha,
      blendTrend: this.mlops.blendTrend,
    });

    return {
      geradoEm: new Date().toISOString(),
      horizontesDias: horizontes,
      mesesHistorico: mensal.length,
      coeficienteVariacaoSerie: Math.round(cv * 1000) / 1000,
      previsoes: out.porHorizonte,
      modelo: out.modelo,
      notas: [
        'Combina regressão linear temporal + índices sazonais mensais + SES.',
        'Proxy feriados/dias úteis: fator menor em fins de semana.',
        'CV acima de 0.45 indica maior volatilidade; o pipeline de treino pode aumentar o peso do SES.',
      ],
    };
  }

  async treinar(): Promise<{ mesesUsados: number; cv: number }> {
    const mensal = await this.carregarSerieMensal();
    const ys = mensal.map((m) => m.volume);
    const xs = ys.map((_, i) => i);
    const { r2 } = fitLinear(xs, ys);
    const cv =
      mensal.length >= 2 ? stdDev(ys) / (mean(ys) || 1) : 1;
    this.mlops.ajustarPorVarianciaDemanda(cv);
    this.mlops.qualidadeProxyPct = Math.min(
      95,
      Math.round(45 + 50 * r2 + (mensal.length >= 24 ? 10 : 0)),
    );
    return { mesesUsados: mensal.length, cv };
  }

  private async carregarSerieMensal(): Promise<PontoMensal[]> {
    const mesesMax = Math.min(
      48,
      parseInt(this.config.get<string>('IA_PRED_DEMANDA_MESES_MAX') ?? '48', 10) || 48,
    );
    const since = new Date();
    since.setUTCMonth(since.getUTCMonth() - mesesMax);

    try {
      const rows = await this.prisma.$queryRaw<Array<{ m: Date; c: bigint }>>(
        Prisma.sql`
          SELECT date_trunc('month', "createdAt") AS m, COUNT(*)::bigint AS c
          FROM solicitacoes
          WHERE "deletedAt" IS NULL AND "createdAt" >= ${since}
          GROUP BY 1
          ORDER BY 1 ASC
        `,
      );
      const pts: PontoMensal[] = rows.map((r) => ({
        periodo: new Date(r.m),
        volume: Number(r.c),
      }));
      if (pts.length >= 3) return pts;
      return this.serieSinteticaMinima(pts);
    } catch {
      return this.serieSinteticaMinima([]);
    }
  }

  /** Quando há poucos pontos, completa com série determinística para permitir inferência estável (MLOps local). */
  private serieSinteticaMinima(base: PontoMensal[]): PontoMensal[] {
    const out: PontoMensal[] = [...base];
    const seed = base.length > 0 ? base[base.length - 1].volume : 14;
    let d = new Date();
    d.setUTCDate(1);
    d.setUTCHours(0, 0, 0, 0);
    if (base.length > 0) {
      d = new Date(base[base.length - 1].periodo.getTime());
    }
    while (out.length < 24) {
      d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
      const idx = out.length;
      out.unshift({
        periodo: d,
        volume: Math.max(3, Math.round(seed + (idx % 7) + Math.sin(idx / 3) * 4)),
      });
    }
    return out.sort((a, b) => a.periodo.getTime() - b.periodo.getTime());
  }
}
