import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkforcePlanningService } from '../workforce-planning/workforce-planning.service';
import type {
  BiFinanceiroResumoRow,
  BiFaturamentoDiarioRow,
  BiFrotaStatusRow,
  BiGateHeatmapRow,
  BiOcupacaoProjetadaRow,
  BiPatioOcupacaoRow,
  BiTatGateRow,
  TorreControleResponse,
  VisaoOperacionalResponse,
} from './bi-analytics.types';

const MV_NAMES = [
  'mv_faturamento_diario',
  'mv_financeiro_resumo',
  'mv_tat_gate',
  'mv_patio_ocupacao',
  'mv_ocupacao_projetada_7d',
  'mv_gate_heatmap',
  'mv_frota_patio_status',
] as const;

const DOW_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  return Number(v);
}

function isoDate(d: Date | string): string {
  const x = d instanceof Date ? d : new Date(d);
  return x.toISOString().slice(0, 10);
}

@Injectable()
export class BiAnalyticsRefreshService {
  private readonly logger = new Logger(BiAnalyticsRefreshService.name);
  private lastRefreshAt: Date | null = null;

  constructor(private readonly prisma: PrismaService) {}

  getLastRefreshAt(): string | null {
    return this.lastRefreshAt?.toISOString() ?? null;
  }

  async refreshAll(): Promise<{ ok: boolean; views: string[] }> {
    const refreshed: string[] = [];
    for (const view of MV_NAMES) {
      try {
        await this.prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${view}`);
        refreshed.push(view);
      } catch (e) {
        this.logger.warn(`Refresh ${view} falhou (tentando sem CONCURRENTLY): ${e instanceof Error ? e.message : e}`);
        await this.prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW ${view}`);
        refreshed.push(view);
      }
    }
    this.lastRefreshAt = new Date();
    this.logger.log(`Materialized views BI atualizadas: ${refreshed.join(', ')}`);
    return { ok: true, views: refreshed };
  }
}

@Injectable()
export class BiAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly refresh: BiAnalyticsRefreshService,
    private readonly workforce: WorkforcePlanningService,
  ) {}

  async getTorreControle(): Promise<TorreControleResponse> {
    const [faturamento, resumo, tat, patio] = await Promise.all([
      this.prisma.$queryRaw<BiFaturamentoDiarioRow[]>`
        SELECT ref_dia, receita_provisionada, receita_faturada FROM mv_faturamento_diario ORDER BY ref_dia ASC
      `,
      this.prisma.$queryRaw<BiFinanceiroResumoRow[]>`
        SELECT dso_dias, faturas_abertas_qtd, faturas_abertas_valor FROM mv_financeiro_resumo WHERE id = 1
      `,
      this.prisma.$queryRaw<BiTatGateRow[]>`
        SELECT ref_dia, ciclos, tat_medio_minutos FROM mv_tat_gate ORDER BY ref_dia DESC LIMIT 30
      `,
      this.prisma.$queryRaw<BiPatioOcupacaoRow[]>`
        SELECT capacidade_total, posicoes_ocupadas, posicoes_livres FROM mv_patio_ocupacao WHERE id = 1
      `,
    ]);

    const fin = resumo[0];
    const pat = patio[0] ?? { capacidade_total: 0, posicoes_ocupadas: 0, posicoes_livres: 0 };
    const tatSorted = [...tat].sort((a, b) => isoDate(a.ref_dia).localeCompare(isoDate(b.ref_dia)));
    const tatMedio =
      tatSorted.length > 0
        ? tatSorted.reduce((s, r) => s + num(r.tat_medio_minutos), 0) / tatSorted.length
        : 0;
    const capacidade = num(pat.capacidade_total);
    const ocupadas = num(pat.posicoes_ocupadas);

    const receitaSerie = faturamento.map((r) => ({
      dia: isoDate(r.ref_dia),
      provisionada: num(r.receita_provisionada),
      faturada: num(r.receita_faturada),
    }));

    const tatSerie = tatSorted.map((r) => ({
      dia: isoDate(r.ref_dia),
      minutos: num(r.tat_medio_minutos),
      ciclos: num(r.ciclos),
    }));

    const tatDetalhe = [...tatSorted].reverse().map((r) => ({
      dia: isoDate(r.ref_dia),
      ciclos: num(r.ciclos),
      tatMedioMinutos: num(r.tat_medio_minutos),
    }));

    const faturamentoDiario = [...receitaSerie].reverse();

    return {
      financeiro: {
        receitaSerie,
        dsoDias: num(fin?.dso_dias),
        faturasAbertasQtd: num(fin?.faturas_abertas_qtd),
        faturasAbertasValor: num(fin?.faturas_abertas_valor),
      },
      operacional: {
        tatMedioMinutos: Math.round(tatMedio * 10) / 10,
        tatMetaVerde: 30,
        tatMetaVermelho: 45,
        tatSerie,
        patio: {
          capacidadeTotal: capacidade,
          ocupadas,
          livres: num(pat.posicoes_livres),
          ocupacaoPercent: capacidade > 0 ? Math.round((ocupadas / capacidade) * 1000) / 10 : 0,
        },
      },
      tabelas: { tatDetalhe, faturamentoDiario },
      atualizadoEm: this.refresh.getLastRefreshAt(),
    };
  }

  async getVisaoOperacional(): Promise<VisaoOperacionalResponse> {
    const [ocupacao, heatmap, frota, workforce] = await Promise.all([
      this.prisma.$queryRaw<BiOcupacaoProjetadaRow[]>`
        SELECT ref_dia, estoque_atual, entradas_agendadas, saidas_agendadas, ocupacao_projetada
        FROM mv_ocupacao_projetada_7d ORDER BY ref_dia ASC
      `,
      this.prisma.$queryRaw<BiGateHeatmapRow[]>`
        SELECT dia_semana, hora_ref, agendamentos FROM mv_gate_heatmap ORDER BY dia_semana, hora_ref
      `,
      this.prisma.$queryRaw<BiFrotaStatusRow[]>`
        SELECT status_label, unidades FROM mv_frota_patio_status ORDER BY unidades DESC
      `,
      this.workforce.analyzeGargalos(),
    ]);

    const ocupacaoProjetada = ocupacao.map((r) => ({
      dia: isoDate(r.ref_dia),
      estoqueAtual: num(r.estoque_atual),
      entradas: num(r.entradas_agendadas),
      saidas: num(r.saidas_agendadas),
      projetada: num(r.ocupacao_projetada),
    }));

    const gateHeatmap = heatmap.map((r) => ({
      diaSemana: num(r.dia_semana),
      diaLabel: DOW_LABELS[num(r.dia_semana)] ?? String(r.dia_semana),
      hora: num(r.hora_ref),
      agendamentos: num(r.agendamentos),
    }));

    const frotaPatio = frota.map((r) => ({
      status: this.labelFrotaStatus(r.status_label),
      unidades: num(r.unidades),
    }));

    return {
      ocupacaoProjetada,
      gateHeatmap,
      frotaPatio,
      riscoEscala: workforce.alertas,
      tabelas: {
        ocupacao: ocupacaoProjetada,
        heatmap: gateHeatmap.map((h) => ({
          diaSemana: h.diaLabel,
          hora: h.hora,
          agendamentos: h.agendamentos,
        })),
        frota: frotaPatio,
        riscoEscala: workforce.alertas.map((a) => ({
          data: a.data,
          turno: a.turnoLabel,
          cargo: a.cargoLabel,
          demanda: a.demanda,
          capacidade: a.capacidade,
          deficit: a.deficit,
          mensagem: a.mensagem,
        })),
      },
      atualizadoEm: this.refresh.getLastRefreshAt(),
    };
  }

  private labelFrotaStatus(raw: string): string {
    const map: Record<string, string> = {
      CHEIO: 'Cheio',
      VAZIO: 'Vazio',
      AVARIADO: 'Avariado',
      BLOQUEADO_MAPA_RECEITA: 'Bloqueado MAPA/Receita',
    };
    return map[raw] ?? raw;
  }
}
