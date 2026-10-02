import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveStoreTenantId } from '../../common/stores/store-tenant.util';
import { TenantContextService } from '../../tenant/tenant-context.service';

export type MobilePushTipo =
  | 'gate_autorizado'
  | 'container_chamado'
  | 'os_critica'
  | 'pagamento_confirmado'
  | 'nota_emitida'
  | 'alerta_risco_grc';

export interface MobilePushJob {
  id: string;
  tipo: MobilePushTipo;
  destinoSub?: string;
  deviceId?: string;
  titulo: string;
  corpo: string;
  meta?: Record<string, unknown>;
  criadoEm: string;
  entregueEm?: string;
}

@Injectable()
export class MobilePushStore {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCtx: TenantContextService,
  ) {}

  private tenantId() {
    return resolveStoreTenantId(this.tenantCtx);
  }

  async registrarFcm(sub: string, token: string) {
    await this.prisma.mobileFcmToken.upsert({
      where: { userSub: sub },
      create: { tenantId: this.tenantId(), userSub: sub, token: token.trim() },
      update: { token: token.trim() },
    });
  }

  async obterFcm(sub: string) {
    const row = await this.prisma.mobileFcmToken.findUnique({ where: { userSub: sub } });
    return row?.token;
  }

  async enfileirar(p: Omit<MobilePushJob, 'id' | 'criadoEm'>): Promise<MobilePushJob> {
    const row = await this.prisma.mobilePushJobRecord.create({
      data: {
        tenantId: this.tenantId(),
        tipo: p.tipo,
        destinoSub: p.destinoSub,
        deviceId: p.deviceId,
        titulo: p.titulo,
        corpo: p.corpo,
        meta: p.meta as Prisma.InputJsonValue | undefined,
      },
    });
    return {
      id: row.id,
      tipo: row.tipo as MobilePushTipo,
      destinoSub: row.destinoSub ?? undefined,
      deviceId: row.deviceId ?? undefined,
      titulo: row.titulo,
      corpo: row.corpo,
      meta: (row.meta as Record<string, unknown>) ?? undefined,
      criadoEm: row.criadoEm.toISOString(),
      entregueEm: row.entregueEm?.toISOString(),
    };
  }

  async pendentesParaSub(sub: string) {
    const rows = await this.prisma.mobilePushJobRecord.findMany({
      where: {
        tenantId: this.tenantId(),
        entregueEm: null,
        OR: [{ destinoSub: sub }, { destinoSub: null }],
      },
      orderBy: { criadoEm: 'desc' },
      take: 100,
    });
    return rows.map((row) => ({
      id: row.id,
      tipo: row.tipo as MobilePushTipo,
      destinoSub: row.destinoSub ?? undefined,
      deviceId: row.deviceId ?? undefined,
      titulo: row.titulo,
      corpo: row.corpo,
      meta: (row.meta as Record<string, unknown>) ?? undefined,
      criadoEm: row.criadoEm.toISOString(),
      entregueEm: row.entregueEm?.toISOString(),
    }));
  }

  async marcarEntregue(id: string) {
    const row = await this.prisma.mobilePushJobRecord.update({
      where: { id },
      data: { entregueEm: new Date() },
    });
    return {
      id: row.id,
      tipo: row.tipo as MobilePushTipo,
      destinoSub: row.destinoSub ?? undefined,
      titulo: row.titulo,
      corpo: row.corpo,
      criadoEm: row.criadoEm.toISOString(),
      entregueEm: row.entregueEm?.toISOString(),
    };
  }

  async listarUltimos(n = 50) {
    const rows = await this.prisma.mobilePushJobRecord.findMany({
      where: { tenantId: this.tenantId() },
      orderBy: { criadoEm: 'desc' },
      take: n,
    });
    return rows.map((row) => ({
      id: row.id,
      tipo: row.tipo as MobilePushTipo,
      titulo: row.titulo,
      corpo: row.corpo,
      meta: (row.meta as Record<string, unknown>) ?? undefined,
      criadoEm: row.criadoEm.toISOString(),
      entregueEm: row.entregueEm?.toISOString(),
    }));
  }
}
