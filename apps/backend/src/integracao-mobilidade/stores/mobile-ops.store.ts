import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContextService } from '../../tenant/tenant-context.service';
import { resolveStoreTenantId } from '../../common/stores/store-tenant.util';

export type MobileCanal = 'portaria' | 'gate' | 'patio' | 'saida';

export interface MobileOpEntry {
  id: string;
  userId: string;
  canal: MobileCanal;
  payload: Record<string, unknown>;
  /** Base64 truncado para observabilidade (payload completo não é persistido em disco nesta fase). */
  payloadDigest: string;
  receivedAt: string;
}

const MAX = 200;

@Injectable()
export class MobileOpsStore {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCtx: TenantContextService,
  ) {}

  private tenantId() {
    return resolveStoreTenantId(this.tenantCtx);
  }

  async add(entry: Omit<MobileOpEntry, 'id' | 'receivedAt'>): Promise<MobileOpEntry> {
    const id = randomUUID();
    const receivedAt = new Date();
    await this.prisma.mobileOpsQueue.create({
      data: {
        id,
        tenantId: this.tenantId(),
        userId: entry.userId,
        canal: entry.canal,
        payload: entry.payload as Prisma.InputJsonValue,
        payloadDigest: entry.payloadDigest,
        receivedAt,
      },
    });

    const count = await this.prisma.mobileOpsQueue.count({
      where: { tenantId: this.tenantId() },
    });
    if (count > MAX) {
      const excess = count - MAX;
      const oldest = await this.prisma.mobileOpsQueue.findMany({
        where: { tenantId: this.tenantId() },
        orderBy: { receivedAt: 'asc' },
        take: excess,
        select: { id: true },
      });
      if (oldest.length) {
        await this.prisma.mobileOpsQueue.deleteMany({
          where: { id: { in: oldest.map((o) => o.id) } },
        });
      }
    }

    return {
      ...entry,
      id,
      receivedAt: receivedAt.toISOString(),
    };
  }

  async byUser(userId: string): Promise<MobileOpEntry[]> {
    const rows = await this.prisma.mobileOpsQueue.findMany({
      where: { tenantId: this.tenantId(), userId },
      orderBy: { receivedAt: 'desc' },
      take: MAX,
    });
    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      canal: r.canal as MobileCanal,
      payload: r.payload as Record<string, unknown>,
      payloadDigest: r.payloadDigest,
      receivedAt: r.receivedAt.toISOString(),
    }));
  }
}
