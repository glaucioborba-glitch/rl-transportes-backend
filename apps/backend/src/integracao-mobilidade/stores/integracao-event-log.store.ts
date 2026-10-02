import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveStoreTenantId } from '../../common/stores/store-tenant.util';
import { TenantContextService } from '../../tenant/tenant-context.service';
import type { IntegracaoTipoEvento } from '../integracao-events.constants';

export interface IntegracaoEventLogEntry {
  id: string;
  tipo: IntegracaoTipoEvento;
  payload: Record<string, unknown>;
  clienteId?: string;
  correlationId?: string;
  at: string;
}

/** Log de integração — write-through PostgreSQL (retenção 90d via CRON). */
@Injectable()
export class IntegracaoEventLogStore {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCtx: TenantContextService,
  ) {}

  private tenantId() {
    return resolveStoreTenantId(this.tenantCtx);
  }

  async push(e: Omit<IntegracaoEventLogEntry, 'at' | 'id'>): Promise<IntegracaoEventLogEntry> {
    const id = randomUUID();
    const row = await this.prisma.integracaoEventLog.create({
      data: {
        id,
        tenantId: this.tenantId(),
        tipo: e.tipo,
        payload: e.payload as Prisma.InputJsonValue,
        clienteId: e.clienteId ?? null,
        correlationId: e.correlationId ?? null,
      },
    });
    return {
      id: row.id,
      tipo: row.tipo as IntegracaoTipoEvento,
      payload: row.payload as Record<string, unknown>,
      clienteId: row.clienteId ?? undefined,
      correlationId: row.correlationId ?? undefined,
      at: row.createdAt.toISOString(),
    };
  }

  async recent(clienteId?: string, limit = 50): Promise<IntegracaoEventLogEntry[]> {
    const rows = await this.prisma.integracaoEventLog.findMany({
      where: {
        tenantId: this.tenantId(),
        ...(clienteId ? { clienteId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map((r) => ({
      id: r.id,
      tipo: r.tipo as IntegracaoTipoEvento,
      payload: r.payload as Record<string, unknown>,
      clienteId: r.clienteId ?? undefined,
      correlationId: r.correlationId ?? undefined,
      at: r.createdAt.toISOString(),
    }));
  }

  async cleanupOlderThan(days: number): Promise<number> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const result = await this.prisma.integracaoEventLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    return result.count;
  }
}
