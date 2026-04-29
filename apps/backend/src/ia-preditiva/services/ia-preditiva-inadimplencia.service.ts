import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { logisticScore, sigmoid } from '../math/score-logistic';
import { IaPreditivaMlopsStore } from '../ia-preditiva-mlops.store';

export type ClusterRisco = 'baixo' | 'medio' | 'alto';

@Injectable()
export class IaPreditivaInadimplenciaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mlops: IaPreditivaMlopsStore,
  ) {}

  async obter() {
    const agregados = await this.agregarPorCliente();
    const totFat = agregados.reduce((s, r) => s + r.valorFaturado12m, 0) || 1;
    const ordenados = [...agregados].sort((a, b) => b.valorFaturado12m - a.valorFaturado12m);
    const cum = ordenados.map((r, i, arr) => {
      const slice = arr.slice(0, i + 1).reduce((x, y) => x + y.valorFaturado12m, 0);
      return { ...r, abcPct: Math.round((slice / totFat) * 1000) / 10 };
    });

    const saida = cum.map((row) => {
      const share = row.valorFaturado12m / totFat;
      const fAtraso = Math.min(3, row.atrasoMedioDias / 45);
      const fAbc = row.abcPct <= 80 ? 0.3 : row.abcPct <= 95 ? 0.6 : 1;
      const fVol = Math.min(2.5, Math.log1p(row.valorFaturado12m) / 12);
      const feats = [fAtraso, fAbc, fVol];
      const z = logisticScore(this.mlops.pesosInadimplencia, feats);
      const probabilidadeInadimplencia = Math.round(sigmoid(z) * 1000) / 1000;
      let cluster: ClusterRisco = 'medio';
      if (probabilidadeInadimplencia < 0.35) cluster = 'baixo';
      else if (probabilidadeInadimplencia > 0.62) cluster = 'alto';

      const explicacao = [
        `atraso_medio_dias=${row.atrasoMedioDias.toFixed(1)}`,
        `share_faturamento_12m=${(share * 100).toFixed(2)}%`,
        `curva_ABC_acum=${row.abcPct}%`,
        `boletos_em_aberto=${row.boletosAbertos}`,
      ];

      return {
        clienteId: row.clienteId,
        probabilidadeInadimplencia,
        cluster,
        explicacaoProxy: explicacao,
      };
    });

    return {
      geradoEm: new Date().toISOString(),
      amostraClientes: saida.length,
      modelo: {
        tipo: 'scorecard_logistico_local',
        pesos: [...this.mlops.pesosInadimplencia],
      },
      clientes: saida.slice(0, 80),
      notas: [
        'Probabilidade via σ(z) com features normalizadas (atraso, ABC, volume log).',
        'Sem modelo externo; coeficientes recalibrados em POST /ia-preditiva/treinar.',
      ],
    };
  }

  async treinar(): Promise<{ pesos: number[] }> {
    const agregados = await this.agregarPorCliente();
    let sumRate = 0;
    let n = 0;
    for (const a of agregados) {
      if (a.qtdBoletos > 0) {
        sumRate += a.boletosAbertos / a.qtdBoletos;
        n++;
      }
    }
    const rate = n ? sumRate / n : 0.18;
    const w = [...this.mlops.pesosInadimplencia];
    w[0] = Math.min(2.4, Math.max(1.2, w[0] + 0.25 * (rate - 0.2)));
    w[1] = Math.min(0.55, Math.max(0.15, w[1] + 0.05 * (rate - 0.2)));
    w[2] = Math.max(-0.55, Math.min(-0.05, w[2] - 0.04 * (rate - 0.2)));
    this.mlops.pesosInadimplencia = w;
    return { pesos: w };
  }

  private async agregarPorCliente(): Promise<
    Array<{
      clienteId: string;
      valorFaturado12m: number;
      atrasoMedioDias: number;
      boletosAbertos: number;
      qtdBoletos: number;
      abcPct: number;
    }>
  > {
    const desde = new Date();
    desde.setUTCMonth(desde.getUTCMonth() - 12);
    try {
      const rows = await this.prisma.$queryRaw<
        Array<{
          cliente_id: string;
          valor_faturado: Prisma.Decimal | null;
          atraso_medio: number | null;
          boletos_abertos: bigint | null;
          qtd_boletos: bigint | null;
        }>
      >(Prisma.sql`
        WITH fat AS (
          SELECT c.id AS cliente_id, COALESCE(SUM(f."valorTotal"), 0)::decimal AS valor_faturado
          FROM clientes c
          LEFT JOIN faturamentos f ON f."clienteId" = c.id AND f."createdAt" >= ${desde}
          GROUP BY c.id
        ),
        bol AS (
          SELECT f."clienteId" AS cliente_id,
                 COUNT(b.id)::bigint AS qtd_boletos,
                 COUNT(*) FILTER (WHERE b."statusPagamento"::text <> 'PAGO' AND b."dataVencimento" < NOW())::bigint AS boletos_abertos,
                 COALESCE(AVG(
                   CASE WHEN b."statusPagamento"::text <> 'PAGO' AND b."dataVencimento" < NOW()
                     THEN EXTRACT(EPOCH FROM (NOW() - b."dataVencimento")) / 86400.0
                   END
                 ), 0)::float AS atraso_medio
          FROM boletos b
          JOIN faturamentos f ON f.id = b."faturamentoId"
          GROUP BY f."clienteId"
        )
        SELECT fat.cliente_id, fat.valor_faturado,
               COALESCE(bol.atraso_medio, 0) AS atraso_medio,
               COALESCE(bol.boletos_abertos, 0) AS boletos_abertos,
               COALESCE(bol.qtd_boletos, 0) AS qtd_boletos
        FROM fat
        LEFT JOIN bol ON bol.cliente_id = fat.cliente_id
        WHERE fat.valor_faturado > 0 OR COALESCE(bol.qtd_boletos, 0) > 0
      `);

      const tot = rows.reduce((s, r) => s + Number(r.valor_faturado ?? 0), 0) || 1;
      const sorted = [...rows].sort((a, b) => Number(b.valor_faturado ?? 0) - Number(a.valor_faturado ?? 0));
      let acc = 0;
      const abcMap = new Map<string, number>();
      for (const r of sorted) {
        acc += Number(r.valor_faturado ?? 0);
        abcMap.set(r.cliente_id, Math.round((acc / tot) * 1000) / 10);
      }

      return rows.map((r) => ({
        clienteId: r.cliente_id,
        valorFaturado12m: Number(r.valor_faturado ?? 0),
        atrasoMedioDias: Number(r.atraso_medio ?? 0),
        boletosAbertos: Number(r.boletos_abertos ?? 0),
        qtdBoletos: Number(r.qtd_boletos ?? 0),
        abcPct: abcMap.get(r.cliente_id) ?? 100,
      }));
    } catch {
      return [];
    }
  }
}
