import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';
import { resolveStoreTenantId } from '../common/stores/store-tenant.util';
import type { LakeFileRecord, LakeOrigem } from './datahub.types';

const GZIP_SIM_RATIO = 0.35;

@Injectable()
export class DatahubLakeStore {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCtx: TenantContextService,
  ) {}

  private tenantId() {
    return resolveStoreTenantId(this.tenantCtx);
  }

  /** Snapshot JSON bruto com versionamento virtual YYYY/MM/DD/HH/mm (compressão gzip apenas simulada). */
  async ingestir(origem: LakeOrigem, payload: Record<string, unknown>): Promise<LakeFileRecord> {
    const now = new Date();
    const y = now.getUTCFullYear();
    const mo = String(now.getUTCMonth() + 1).padStart(2, '0');
    const d = String(now.getUTCDate()).padStart(2, '0');
    const h = String(now.getUTCHours()).padStart(2, '0');
    const mi = String(now.getUTCMinutes()).padStart(2, '0');
    const id = randomUUID();
    const pathVirtual = `raw/${origem}/${y}/${mo}/${d}/${h}/${mi}/${id}.json`;
    const raw = Buffer.from(JSON.stringify(payload), 'utf8');
    const tamanhoBrutoBytes = raw.length;
    const bytesCompactadosAprox = Math.max(1, Math.round(tamanhoBrutoBytes * GZIP_SIM_RATIO));

    await this.prisma.datahubLakeArquivo.create({
      data: {
        id,
        tenantId: this.tenantId(),
        origem,
        pathVirtual,
        payload: payload as Prisma.InputJsonValue,
        tamanhoBrutoBytes,
        gzipSimuladoRatio: GZIP_SIM_RATIO,
        bytesCompactadosAprox,
      },
    });

    return {
      id,
      pathVirtual,
      origem,
      criadoEm: now.toISOString(),
      tamanhoBrutoBytes,
      gzipSimuladoRatio: GZIP_SIM_RATIO,
      bytesCompactadosAprox,
    };
  }

  async listar(): Promise<LakeFileRecord[]> {
    const rows = await this.prisma.datahubLakeArquivo.findMany({
      where: { tenantId: this.tenantId() },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      pathVirtual: r.pathVirtual,
      origem: r.origem as LakeOrigem,
      criadoEm: r.createdAt.toISOString(),
      tamanhoBrutoBytes: r.tamanhoBrutoBytes,
      gzipSimuladoRatio:
        typeof r.gzipSimuladoRatio === 'number' ? r.gzipSimuladoRatio : r.gzipSimuladoRatio.toNumber(),
      bytesCompactadosAprox: r.bytesCompactadosAprox,
    }));
  }

  async count(): Promise<number> {
    return this.prisma.datahubLakeArquivo.count({ where: { tenantId: this.tenantId() } });
  }
}
