import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { resolveStoreTenantId } from '../common/stores/store-tenant.util';
import { TenantContextService } from '../tenant/tenant-context.service';
import type { ExtratoLinhaNormalizada } from './extrato-parser';

export interface ExtratoLoteArmazenado {
  batchId: string;
  formato: 'OFX' | 'CSV' | 'API';
  nomeOrigem?: string;
  importadoEm: Date;
  linhas: ExtratoLinhaNormalizada[];
}

/** Write-through PostgreSQL — extratos de conciliação bancária. */
@Injectable()
export class ExtratoStoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCtx: TenantContextService,
  ) {}

  private tenantId() {
    return resolveStoreTenantId(this.tenantCtx);
  }

  private rowToLinha(row: {
    idLinha: string;
    batchId: string;
    indice: number;
    dataLancamento: string;
    historico: string;
    valor: Prisma.Decimal;
    tipo: string;
    saldoParcial: Prisma.Decimal | null;
    documento: string | null;
    nossoNumero: string | null;
    fitId: string | null;
  }): ExtratoLinhaNormalizada {
    return {
      idLinha: row.idLinha,
      batchId: row.batchId,
      indice: row.indice,
      dataLancamento: row.dataLancamento,
      historico: row.historico,
      valor: Number(row.valor),
      tipo: row.tipo as ExtratoLinhaNormalizada['tipo'],
      saldoParcial: row.saldoParcial != null ? Number(row.saldoParcial) : undefined,
      documento: row.documento ?? undefined,
      nossoNumero: row.nossoNumero ?? undefined,
      fitId: row.fitId ?? undefined,
    };
  }

  async salvarLote(
    batchId: string,
    linhas: ExtratoLinhaNormalizada[],
    formato: ExtratoLoteArmazenado['formato'],
    nomeOrigem?: string,
  ): Promise<string> {
    const tenantId = this.tenantId();
    await this.prisma.financeiroExtratoLote.create({
      data: {
        batchId,
        tenantId,
        formato,
        nomeOrigem: nomeOrigem ?? null,
        linhas: {
          create: linhas.map((l) => ({
            idLinha: l.idLinha,
            tenantId,
            indice: l.indice,
            dataLancamento: l.dataLancamento,
            historico: l.historico,
            valor: l.valor,
            tipo: l.tipo,
            saldoParcial: l.saldoParcial ?? null,
            documento: l.documento ?? null,
            nossoNumero: l.nossoNumero ?? null,
            fitId: l.fitId ?? null,
          })),
        },
      },
    });
    return batchId;
  }

  async listarLotes(): Promise<ExtratoLoteArmazenado[]> {
    const rows = await this.prisma.financeiroExtratoLote.findMany({
      where: { tenantId: this.tenantId() },
      orderBy: { importadoEm: 'desc' },
      include: { linhas: { orderBy: { indice: 'asc' } } },
    });
    return rows.map((l) => ({
      batchId: l.batchId,
      formato: l.formato as ExtratoLoteArmazenado['formato'],
      nomeOrigem: l.nomeOrigem ?? undefined,
      importadoEm: l.importadoEm,
      linhas: l.linhas.map((r) => this.rowToLinha(r)),
    }));
  }

  async getLote(batchId: string): Promise<ExtratoLoteArmazenado | undefined> {
    const l = await this.prisma.financeiroExtratoLote.findFirst({
      where: { tenantId: this.tenantId(), batchId },
      include: { linhas: { orderBy: { indice: 'asc' } } },
    });
    if (!l) return undefined;
    return {
      batchId: l.batchId,
      formato: l.formato as ExtratoLoteArmazenado['formato'],
      nomeOrigem: l.nomeOrigem ?? undefined,
      importadoEm: l.importadoEm,
      linhas: l.linhas.map((r) => this.rowToLinha(r)),
    };
  }

  async todasLinhas(batchId?: string): Promise<ExtratoLinhaNormalizada[]> {
    const where: Prisma.FinanceiroExtratoLinhaWhereInput = {
      tenantId: this.tenantId(),
      ...(batchId ? { batchId } : {}),
    };
    const rows = await this.prisma.financeiroExtratoLinha.findMany({
      where,
      orderBy: [{ batchId: 'desc' }, { indice: 'asc' }],
    });
    return rows.map((r) => this.rowToLinha(r));
  }

  async registrarManual(linhaId: string, boletoId: string, faturamentoId: string): Promise<void> {
    await this.prisma.financeiroExtratoConciliacaoManual.upsert({
      where: { linhaId },
      create: { linhaId, boletoId, faturamentoId },
      update: { boletoId, faturamentoId },
    });
  }

  async getManualMap(): Promise<Map<string, { boletoId: string; faturamentoId: string }>> {
    const rows = await this.prisma.financeiroExtratoConciliacaoManual.findMany({
      where: { linha: { tenantId: this.tenantId() } },
    });
    return new Map(rows.map((r) => [r.linhaId, { boletoId: r.boletoId, faturamentoId: r.faturamentoId }]));
  }
}
