import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { mean, stdDev } from '../math/linear-regression';

export type SeveridadeAnomalia = 'ALTA' | 'MEDIA' | 'BAIXA';

export interface ItemAnomalia {
  tipo: string;
  severidade: SeveridadeAnomalia;
  detalhe: string;
  referencia?: string;
}

@Injectable()
export class IaPreditivaAnomaliasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async obter(): Promise<{ geradoEm: string; anomalias: ItemAnomalia[] }> {
    const [dupIso, gateSemPortaria, fatZip, foraHorario] = await Promise.all([
      this.detectarIsoDuplicado(),
      this.detectarGateSemPortaria(),
      this.detectarFaturamentoAtipico(),
      this.detectarMovimentacaoForaHorario(),
    ]);
    const anomalias = [...dupIso, ...gateSemPortaria, ...fatZip, ...foraHorario].sort((a, b) => {
      const ord = { ALTA: 0, MEDIA: 1, BAIXA: 2 };
      return ord[a.severidade] - ord[b.severidade];
    });
    return { geradoEm: new Date().toISOString(), anomalias };
  }

  private async detectarIsoDuplicado(): Promise<ItemAnomalia[]> {
    try {
      const rows = await this.prisma.$queryRaw<Array<{ iso: string; c: bigint }>>(
        Prisma.sql`
          SELECT u."numeroIso" AS iso, COUNT(*)::bigint AS c
          FROM unidades_solicitacao u
          INNER JOIN solicitacoes s ON s.id = u."solicitacaoId"
          WHERE s."deletedAt" IS NULL
          GROUP BY u."numeroIso"
          HAVING COUNT(*) > 1
          LIMIT 40
        `,
      );
      return rows.map((r) => ({
        tipo: 'ISO_DUPLICADO',
        severidade: 'ALTA' as const,
        detalhe: `Container ISO repetido em ${Number(r.c)} solicitações.`,
        referencia: r.iso,
      }));
    } catch {
      return [];
    }
  }

  private async detectarGateSemPortaria(): Promise<ItemAnomalia[]> {
    try {
      const rows = await this.prisma.solicitacao.findMany({
        where: {
          deletedAt: null,
          gate: { isNot: null },
          portaria: null,
        },
        take: 50,
        select: { id: true, protocolo: true },
      });
      return rows.map((r) => ({
        tipo: 'GATE_SEM_PORTARIA',
        severidade: 'ALTA' as const,
        detalhe: 'Gate registrado sem fluxo de portaria (sequência operacional suspeita).',
        referencia: r.protocolo,
      }));
    } catch {
      return [];
    }
  }

  private async detectarFaturamentoAtipico(): Promise<ItemAnomalia[]> {
    try {
      const rows = await this.prisma.faturamento.findMany({
        where: { createdAt: { gte: new Date(Date.now() - 400 * 86400000) } },
        select: { id: true, clienteId: true, periodo: true, valorTotal: true },
        take: 500,
      });
      const vals = rows.map((r) => Number(r.valorTotal));
      if (vals.length < 5) return [];
      const mu = mean(vals);
      const sigma = stdDev(vals) || 1;
      const zCut = parseFloat(this.config.get<string>('IA_PRED_ANOM_Z') ?? '2.5') || 2.5;
      const out: ItemAnomalia[] = [];
      for (const r of rows) {
        const v = Number(r.valorTotal);
        const z = Math.abs((v - mu) / sigma);
        if (z >= zCut) {
          out.push({
            tipo: 'FATURAMENTO_ATIPICO',
            severidade: z >= zCut + 1 ? 'MEDIA' : 'BAIXA',
            detalhe: `Valor ${v.toFixed(2)} desvia z=${z.toFixed(2)} da média histórica recente.`,
            referencia: `${r.periodo}:${r.clienteId.slice(0, 8)}`,
          });
        }
      }
      return out.slice(0, 40);
    } catch {
      return [];
    }
  }

  private async detectarMovimentacaoForaHorario(): Promise<ItemAnomalia[]> {
    const ini = parseInt(this.config.get<string>('IA_PRED_HORA_UTIL_INI') ?? '6', 10);
    const fim = parseInt(this.config.get<string>('IA_PRED_HORA_UTIL_FIM') ?? '22', 10);
    try {
      const rows = await this.prisma.solicitacao.findMany({
        where: {
          deletedAt: null,
          updatedAt: { gte: new Date(Date.now() - 30 * 86400000) },
        },
        select: { protocolo: true, updatedAt: true },
        take: 800,
      });
      const out: ItemAnomalia[] = [];
      for (const r of rows) {
        const h = r.updatedAt.getUTCHours();
        if (h < ini || h >= fim) {
          out.push({
            tipo: 'MOVIMENTACAO_FORA_HORARIO_PADRAO',
            severidade: 'BAIXA',
            detalhe: `Atualização UTC hora ${h} fora da janela operacional [${ini}, ${fim}).`,
            referencia: r.protocolo,
          });
        }
      }
      return out.slice(0, 30);
    } catch {
      return [];
    }
  }
}
