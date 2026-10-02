import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveStoreTenantId } from '../../common/stores/store-tenant.util';
import { TenantContextService } from '../../tenant/tenant-context.service';

export type MobileTelemetryBatch = {
  id: string;
  deviceId: string;
  userSub: string;
  mobileRole: string;
  localizacao?: { lat: number; lng: number; precisaoM?: number };
  redeForca?: number;
  latenciaMsMedia?: number;
  errosRecorrentes?: string[];
  usoOffline?: boolean;
  recebidoEm: string;
};

@Injectable()
export class MobileTelemetryStore {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCtx: TenantContextService,
  ) {}

  private tenantId() {
    return resolveStoreTenantId(this.tenantCtx);
  }

  private toBatch(row: {
    id: string;
    deviceId: string | null;
    userId: string;
    mobileRole: string | null;
    lat: number | null;
    lon: number | null;
    networkStrength: number | null;
    latencyMs: number | null;
    errors: unknown;
    offlineUsageSec: number;
    createdAt: Date;
  }): MobileTelemetryBatch {
    return {
      id: row.id,
      deviceId: row.deviceId ?? 'unknown',
      userSub: row.userId,
      mobileRole: row.mobileRole ?? 'unknown',
      localizacao:
        row.lat != null && row.lon != null
          ? { lat: row.lat, lng: row.lon }
          : undefined,
      redeForca: row.networkStrength ?? undefined,
      latenciaMsMedia: row.latencyMs ?? undefined,
      errosRecorrentes: Array.isArray(row.errors) ? (row.errors as string[]) : [],
      usoOffline: row.offlineUsageSec > 0,
      recebidoEm: row.createdAt.toISOString(),
    };
  }

  async registrar(b: Omit<MobileTelemetryBatch, 'id' | 'recebidoEm'>): Promise<MobileTelemetryBatch> {
    const id = randomUUID();
    const row = await this.prisma.mobileTelemetry.create({
      data: {
        id,
        tenantId: this.tenantId(),
        deviceId: b.deviceId,
        userId: b.userSub,
        mobileRole: b.mobileRole,
        canal: b.mobileRole,
        lat: b.localizacao?.lat ?? null,
        lon: b.localizacao?.lng ?? null,
        networkStrength: b.redeForca ?? null,
        latencyMs: b.latenciaMsMedia ?? null,
        errors: b.errosRecorrentes ?? [],
        offlineUsageSec: b.usoOffline ? 1 : 0,
      },
    });
    return this.toBatch(row);
  }

  async agregadoStaff() {
    const corte = new Date(Date.now() - 24 * 3600 * 1000);
    const recent = await this.prisma.mobileTelemetry.findMany({
      where: { tenantId: this.tenantId(), createdAt: { gte: corte } },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });
    const offline = recent.filter((b) => b.offlineUsageSec > 0).length;
    const lat = recent.filter((b) => b.latencyMs != null).map((b) => b.latencyMs!);
    const latMedia = lat.length ? lat.reduce((a, b) => a + b, 0) / lat.length : null;
    return {
      janelaHoras: 24,
      batches: recent.length,
      usoOfflinePct: recent.length ? Math.round((offline / recent.length) * 100) : 0,
      latenciaMsMedia: latMedia != null ? Math.round(latMedia) : null,
      dispositivosUnicosProxy: new Set(recent.map((b) => b.deviceId).filter(Boolean)).size,
    };
  }

  async ultimosJanela(n = 200): Promise<MobileTelemetryBatch[]> {
    const rows = await this.prisma.mobileTelemetry.findMany({
      where: { tenantId: this.tenantId() },
      orderBy: { createdAt: 'desc' },
      take: n,
    });
    return rows.map((r) => this.toBatch(r));
  }

  async cleanupOlderThan(days: number): Promise<number> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const result = await this.prisma.mobileTelemetry.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    return result.count;
  }
}
