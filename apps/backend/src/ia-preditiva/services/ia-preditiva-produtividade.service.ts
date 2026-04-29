import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, StatusSolicitacao } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { fitLinear } from '../math/linear-regression';
import { IaPreditivaMlopsStore } from '../ia-preditiva-mlops.store';

@Injectable()
export class IaPreditivaProdutividadeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mlops: IaPreditivaMlopsStore,
  ) {}

  async obter() {
    const semanas = await this.conclusoesPorSemana();
    const xs = semanas.map((_, i) => i);
    const ys = semanas.map((s) => s.c);
    const { a, b, r2 } = fitLinear(xs, ys);
    const proxSemana = Math.max(0, a + b * (xs.length ? xs[xs.length - 1] + 1 : 0));
    const horasDia = this.mlops.prodHorasEfectivasPorDia;
    const horasSemana = horasDia * 7;
    const produtividadePrevistaUPH =
      horasSemana > 0 ? Math.round((proxSemana / horasSemana) * 1000) / 1000 : 0;

    const backlog = await this.backlogPorEtapa();
    let gargaloProvavel = 'NEUTRO';
    if (backlog.pendente > backlog.aprovado * 2 && backlog.pendente > 8) gargaloProvavel = 'PORTARIA';
    else if (backlog.aprovado > backlog.noPatio * 1.5 && backlog.aprovado > 8) gargaloProvavel = 'GATE';
    else if (backlog.noPatio > 12) gargaloProvavel = 'PATIO_SAIDA';

    const clima = parseFloat(this.config.get<string>('IA_PRED_CLIMA_FATOR') ?? '1') || 1;
    const impactoCicloDias =
      clima < 0.95 ? Math.round((1 - clima) * 5 * 100) / 100 : Math.round((clima - 1) * 3 * 100) / 100;

    return {
      geradoEm: new Date().toISOString(),
      semanasHistorico: ys.length,
      produtividadePrevistaUPH,
      horasEfectivasPorDia: horasDia,
      gargaloProvavel,
      impactoCicloDiasProxy: impactoCicloDias,
      modelo: {
        tipo: 'regressao_linear_semanal + media movel implicita',
        r2,
        coefTendenciaSemanal: b,
        climaFator: clima,
      },
      backlogEtapa: backlog,
      notas: [
        'UPH = conclusões previstas por semana ÷ (7 × horas efectivas).',
        'Clima é proxy configurável (IA_PRED_CLIMA_FATOR), sem API externa.',
      ],
    };
  }

  /**
   * Recalibra horas efectivas/dia com base na razão conclusões observadas vs capacidade nominal implícita.
   */
  async treinar(): Promise<{ horasDia: number }> {
    const desde = new Date();
    desde.setUTCDate(desde.getUTCDate() - 56);
    let n = 0;
    try {
      n = await this.prisma.solicitacao.count({
        where: {
          deletedAt: null,
          status: StatusSolicitacao.CONCLUIDO,
          updatedAt: { gte: desde },
        },
      });
    } catch {
      n = 0;
    }
    const horas = this.mlops.prodHorasEfectivasPorDia;
    const uphObs = n > 0 ? n / (56 * horas) : 2.5;
    if (uphObs > 6.5) this.mlops.prodHorasEfectivasPorDia = Math.min(22, horas + 0.4);
    else if (uphObs < 2) this.mlops.prodHorasEfectivasPorDia = Math.max(10, horas - 0.4);
    return { horasDia: this.mlops.prodHorasEfectivasPorDia };
  }

  private async conclusoesPorSemana(): Promise<Array<{ w: Date; c: number }>> {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 70);
    try {
      const rows = await this.prisma.$queryRaw<Array<{ w: Date; c: bigint }>>(
        Prisma.sql`
          SELECT date_trunc('week', "updatedAt") AS w, COUNT(*)::bigint AS c
          FROM solicitacoes
          WHERE "deletedAt" IS NULL AND "status" = 'CONCLUIDO'
            AND "updatedAt" >= ${since}
          GROUP BY 1 ORDER BY 1 ASC
        `,
      );
      if (rows.length >= 2) return rows.map((r) => ({ w: new Date(r.w), c: Number(r.c) }));
    } catch {
      /* fallback sintético */
    }
    const out: Array<{ w: Date; c: number }> = [];
    for (let i = 0; i < 8; i++) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - (7 * (7 - i)));
      out.push({ w: d, c: 12 + i * 2 + (i % 3) });
    }
    return out;
  }

  private async backlogPorEtapa(): Promise<{
    pendente: number;
    aprovado: number;
    noPatio: number;
  }> {
    try {
      const [pendente, aprovado, noPatio] = await Promise.all([
        this.prisma.solicitacao.count({
          where: { deletedAt: null, status: StatusSolicitacao.PENDENTE },
        }),
        this.prisma.solicitacao.count({
          where: { deletedAt: null, status: StatusSolicitacao.APROVADO },
        }),
        this.prisma.solicitacao.count({
          where: {
            deletedAt: null,
            status: StatusSolicitacao.APROVADO,
            patio: { isNot: null },
            saida: null,
          },
        }),
      ]);
      return { pendente, aprovado, noPatio };
    } catch {
      return { pendente: 0, aprovado: 0, noPatio: 0 };
    }
  }
}
