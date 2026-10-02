import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContextService } from '../../tenant/tenant-context.service';
import { resolveStoreTenantId } from '../../common/stores/store-tenant.util';

export type AutomacaoExecucaoTipo = 'workflow' | 'orquestrador' | 'regra' | 'rpa';

export interface AutomacaoExecucaoLog {
  id: string;
  tipo: AutomacaoExecucaoTipo;
  evento?: string;
  workflowId?: string;
  regraId?: string;
  rpaJobId?: string;
  ok: boolean;
  detalhe?: string;
  acoesResumo: string[];
  criadoEm: string;
}

@Injectable()
export class AutomacaoExecucaoStore {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCtx: TenantContextService,
  ) {}

  private tenantId() {
    return resolveStoreTenantId(this.tenantCtx);
  }

  async registrar(entry: Omit<AutomacaoExecucaoLog, 'id' | 'criadoEm'>): Promise<AutomacaoExecucaoLog> {
    const id = randomUUID();
    const row = await this.prisma.automacaoExecucao.create({
      data: {
        id,
        tenantId: this.tenantId(),
        tipo: entry.tipo,
        evento: entry.evento ?? null,
        workflowId: entry.workflowId ?? null,
        regraId: entry.regraId ?? null,
        rpaJobId: entry.rpaJobId ?? null,
        ok: entry.ok,
        detalhe: entry.detalhe ?? null,
        acoesResumo: entry.acoesResumo,
      },
    });
    return this.mapRow(row);
  }

  async ultimas24h(): Promise<AutomacaoExecucaoLog[]> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const rows = await this.prisma.automacaoExecucao.findMany({
      where: { tenantId: this.tenantId(), createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });
    return rows.map((r) => this.mapRow(r));
  }

  async comErroUltimas24h(): Promise<AutomacaoExecucaoLog[]> {
    const logs = await this.ultimas24h();
    return logs.filter((l) => !l.ok);
  }

  private mapRow(row: {
    id: string;
    tipo: string;
    evento: string | null;
    workflowId: string | null;
    regraId: string | null;
    rpaJobId: string | null;
    ok: boolean;
    detalhe: string | null;
    acoesResumo: unknown;
    createdAt: Date;
  }): AutomacaoExecucaoLog {
    return {
      id: row.id,
      tipo: row.tipo as AutomacaoExecucaoTipo,
      evento: row.evento ?? undefined,
      workflowId: row.workflowId ?? undefined,
      regraId: row.regraId ?? undefined,
      rpaJobId: row.rpaJobId ?? undefined,
      ok: row.ok,
      detalhe: row.detalhe ?? undefined,
      acoesResumo: Array.isArray(row.acoesResumo) ? (row.acoesResumo as string[]) : [],
      criadoEm: row.createdAt.toISOString(),
    };
  }
}
