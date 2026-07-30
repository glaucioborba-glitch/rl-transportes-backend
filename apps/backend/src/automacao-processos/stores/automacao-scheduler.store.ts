import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContextService } from '../../tenant/tenant-context.service';
import { resolveStoreTenantId } from '../../common/stores/store-tenant.util';
import type { CronJobDef } from '../automacao.types';

@Injectable()
export class AutomacaoSchedulerStore {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCtx: TenantContextService,
  ) {}

  private tenantId() {
    return resolveStoreTenantId(this.tenantCtx);
  }

  async listar(): Promise<CronJobDef[]> {
    const rows = await this.prisma.automacaoCronJob.findMany({
      where: { tenantId: this.tenantId() },
    });
    return rows.map((r) => this.mapRow(r));
  }

  async adicionar(p: Omit<CronJobDef, 'id'>): Promise<CronJobDef> {
    const id = randomUUID();
    const row = await this.prisma.automacaoCronJob.create({
      data: {
        id,
        tenantId: this.tenantId(),
        expressao: p.expressao,
        descricao: p.descricao ?? null,
        acao: p.acao,
        ativo: p.ativo,
        ultimaExecucao: p.ultimaExecucaoProxy ? new Date(p.ultimaExecucaoProxy) : null,
      },
    });
    return this.mapRow(row);
  }

  private mapRow(row: {
    id: string;
    expressao: string;
    descricao: string | null;
    acao: string;
    ativo: boolean;
    ultimaExecucao: Date | null;
  }): CronJobDef {
    return {
      id: row.id,
      expressao: row.expressao,
      descricao: row.descricao ?? '',
      acao: row.acao,
      ativo: row.ativo,
      ultimaExecucaoProxy: row.ultimaExecucao?.toISOString(),
    };
  }
}
