import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveStoreTenantId } from '../../common/stores/store-tenant.util';
import { TenantContextService } from '../../tenant/tenant-context.service';

export type OfflineOpType =
  | 'gate_in'
  | 'gate_out'
  | 'patio'
  | 'portaria'
  | 'checkin_motorista'
  | 'telemetria_batch';

export interface OfflineEventRecord {
  id: string;
  deviceId: string;
  userSub: string;
  op: OfflineOpType;
  body: Record<string, unknown>;
  clientTs: number;
  recebidoEm: string;
  synced: boolean;
  conflictResolved?: string;
}

@Injectable()
export class MobileOfflineSyncStore {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCtx: TenantContextService,
  ) {}

  private tenantId() {
    return resolveStoreTenantId(this.tenantCtx);
  }

  private mapRow(row: {
    id: string;
    deviceId: string;
    userSub: string;
    op: string;
    body: unknown;
    clientTs: bigint;
    recebidoEm: Date;
    synced: boolean;
    conflictResolved: string | null;
  }): OfflineEventRecord {
    return {
      id: row.id,
      deviceId: row.deviceId,
      userSub: row.userSub,
      op: row.op as OfflineOpType,
      body: row.body as Record<string, unknown>,
      clientTs: Number(row.clientTs),
      recebidoEm: row.recebidoEm.toISOString(),
      synced: row.synced,
      conflictResolved: row.conflictResolved ?? undefined,
    };
  }

  async enfileirar(
    e: Omit<OfflineEventRecord, 'id' | 'recebidoEm' | 'synced' | 'conflictResolved'>,
  ): Promise<OfflineEventRecord> {
    const row = await this.prisma.mobileOfflineEvent.create({
      data: {
        tenantId: this.tenantId(),
        deviceId: e.deviceId,
        userSub: e.userSub,
        op: e.op,
        body: e.body as Prisma.InputJsonValue,
        clientTs: BigInt(e.clientTs),
        recebidoEm: new Date(),
      },
    });
    return this.mapRow(row);
  }

  async listarPendentes(deviceId: string): Promise<OfflineEventRecord[]> {
    const rows = await this.prisma.mobileOfflineEvent.findMany({
      where: { deviceId, synced: false, tenantId: this.tenantId() },
      orderBy: { recebidoEm: 'asc' },
      take: 500,
    });
    return rows.map((r) => this.mapRow(r));
  }

  async marcarSincronizado(ids: string[]) {
    if (!ids.length) return;
    await this.prisma.mobileOfflineEvent.updateMany({
      where: { id: { in: ids } },
      data: { synced: true },
    });
  }

  resolverLww(grupo: OfflineEventRecord[]): OfflineEventRecord {
    return grupo.reduce((a, b) => (a.clientTs >= b.clientTs ? a : b));
  }

  async ultimos(n = 100) {
    const rows = await this.prisma.mobileOfflineEvent.findMany({
      where: { tenantId: this.tenantId() },
      orderBy: { recebidoEm: 'desc' },
      take: n,
    });
    return rows.map((r) => this.mapRow(r));
  }
}
