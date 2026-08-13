import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContextService } from '../../tenant/tenant-context.service';
import { resolveStoreTenantId } from '../../common/stores/store-tenant.util';

export type IotTipoSensor = 'ocupacaoPatio' | 'temperaturaContainer' | 'vigilanciaMovimento';

export interface IotReading {
  id: string;
  tipo: IotTipoSensor;
  valor: number;
  raw?: Record<string, unknown>;
  receivedAt: string;
}

const MAX = 500;

@Injectable()
export class IotSensorStore {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCtx: TenantContextService,
  ) {}

  private tenantId() {
    return resolveStoreTenantId(this.tenantCtx);
  }

  async add(input: Omit<IotReading, 'id' | 'receivedAt'>): Promise<IotReading> {
    const id = randomUUID();
    const receivedAt = new Date();
    await this.prisma.iotReading.create({
      data: {
        id,
        tenantId: this.tenantId(),
        sensorId: input.tipo,
        tipo: input.tipo,
        valor: { valor: input.valor, raw: input.raw ?? null } as Prisma.InputJsonValue,
        timestamp: receivedAt,
      },
    });

    const count = await this.prisma.iotReading.count({ where: { tenantId: this.tenantId() } });
    if (count > MAX) {
      const excess = count - MAX;
      const oldest = await this.prisma.iotReading.findMany({
        where: { tenantId: this.tenantId() },
        orderBy: { timestamp: 'asc' },
        take: excess,
        select: { id: true },
      });
      if (oldest.length) {
        await this.prisma.iotReading.deleteMany({ where: { id: { in: oldest.map((o) => o.id) } } });
      }
    }

    return { ...input, id, receivedAt: receivedAt.toISOString() };
  }

  async recent(limit = 100): Promise<IotReading[]> {
    const rows = await this.prisma.iotReading.findMany({
      where: { tenantId: this.tenantId() },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
    return rows.map((r) => {
      const val = r.valor as { valor?: number; raw?: Record<string, unknown> };
      return {
        id: r.id,
        tipo: r.tipo as IotTipoSensor,
        valor: typeof val?.valor === 'number' ? val.valor : 0,
        raw: val?.raw ?? undefined,
        receivedAt: r.timestamp.toISOString(),
      };
    });
  }
}
