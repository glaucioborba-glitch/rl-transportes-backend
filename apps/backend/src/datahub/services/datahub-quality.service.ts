import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DatahubDwStore } from '../datahub-dw.store';
import {
  consistenciaTemporalViolacoes,
  contarFkClienteOrfasNosFatos,
  extrairSkClientesDim,
  taxaCompletudeCampos,
} from '../datahub-quality.metrics';

@Injectable()
export class DatahubQualityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dw: DatahubDwStore,
  ) {}

  async snapshot() {
    const dupIso = await this.duplicadosIso();
    const solicRows = await this.prisma.solicitacao.findMany({
      where: { deletedAt: null },
      take: 8000,
      select: { id: true, clienteId: true, protocolo: true, createdAt: true, updatedAt: true },
    });
    const completude = taxaCompletudeCampos(solicRows as unknown as Record<string, unknown>[], [
      'clienteId',
      'protocolo',
    ]);
    const violTemp = consistenciaTemporalViolacoes(
      solicRows.map((s) => ({ ini: s.createdAt, fim: s.updatedAt })),
    );

    const orfasSolicCliente = await this.contarSolicitacoesClienteInvalido();
    const skDim = extrairSkClientesDim(this.dw.dimensoes['DIM_Clientes']);
    const orfasDwFkCliente = contarFkClienteOrfasNosFatos(this.dw.fatos, skDim);

    return {
      geradoEm: new Date().toISOString(),
      duplicidadeIso: dupIso,
      completudeSolicitacaoProxy: completude,
      inconsistenciasTemporalidade: violTemp,
      chavesOrfas: {
        solicitacoesSemClienteAtivo: orfasSolicCliente,
        fatosComFkClienteInexistenteNaDim: orfasDwFkCliente,
        dimensoesClientesSkDistintos: skDim.size,
      },
      observacao:
        'Métricas são proxies sobre amostras limitadas; reconciliação fiscal usa vínculos Prisma.',
    };
  }

  async verificarProfundo() {
    const snap = await this.snapshot();
    const fatSum = await this.prisma.faturamento.aggregate({
      _sum: { valorTotal: true },
    });
    const nfsC = await this.prisma.nfsEmitida.count();
    const solC = await this.prisma.solicitacao.count({ where: { deletedAt: null } });
    const dwLinhas = Object.values(this.dw.fatos).reduce((a, rows) => a + (rows?.length ?? 0), 0);

    const reconciliacao = {
      valorFaturamentoSum: Number(fatSum._sum.valorTotal ?? 0),
      nfsEmitidas: nfsC,
      solicitacoesAtivas: solC,
      linhasDwMemoria: dwLinhas,
      gapProxyOperacaoFinanceiro:
        solC > 0 ? Math.min(1, Math.abs(solC - nfsC) / solC) : 0,
    };

    return {
      mensagem: 'Verificação de qualidade executada (read-only).',
      snapshot: snap,
      reconciliacao,
      governanca: {
        dwUltimaCarga: this.dw.ultimaCargaEm,
      },
    };
  }

  private async contarSolicitacoesClienteInvalido(): Promise<number> {
    try {
      const rows = await this.prisma.$queryRaw<Array<{ c: bigint }>>(
        Prisma.sql`
          SELECT COUNT(*)::bigint AS c
          FROM solicitacoes s
          LEFT JOIN clientes c ON c.id = s."clienteId" AND c."deletedAt" IS NULL
          WHERE s."deletedAt" IS NULL AND c.id IS NULL
        `,
      );
      return Number(rows[0]?.c ?? 0);
    } catch {
      return 0;
    }
  }

  private async duplicadosIso(): Promise<{ taxa: number; grupos: number }> {
    try {
      const rows = await this.prisma.$queryRaw<Array<{ iso: string; c: bigint }>>(
        Prisma.sql`
          SELECT u."numeroIso" AS iso, COUNT(*)::bigint AS c
          FROM unidades_solicitacao u
          INNER JOIN solicitacoes s ON s.id = u."solicitacaoId"
          WHERE s."deletedAt" IS NULL
          GROUP BY u."numeroIso"
          HAVING COUNT(*) > 1
        `,
      );
      const grupos = rows.length;
      const dupLinhas = rows.reduce((a, r) => a + (Number(r.c) - 1), 0);
      const totalU = await this.prisma.unidade.count({
        where: { solicitacao: { deletedAt: null } },
      });
      const taxa = totalU > 0 ? Math.round((dupLinhas / totalU) * 1000) / 1000 : 0;
      return { taxa, grupos };
    } catch {
      return { taxa: 0, grupos: 0 };
    }
  }
}
