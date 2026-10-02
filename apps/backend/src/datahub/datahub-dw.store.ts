import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';
import { resolveStoreTenantId } from '../common/stores/store-tenant.util';
import {
  DATAHUB_FATO_TO_MV,
  DATAHUB_L1_CACHE_TTL_MS,
  type DatahubMvName,
} from './datahub-mv.constants';
import type { NomeDim, NomeFato } from './datahub.types';

function extractSk(row: Record<string, unknown>, fallback: string): string {
  for (const k of Object.keys(row)) {
    if (k.startsWith('sk_') && row[k] != null) return String(row[k]);
  }
  return fallback;
}

/** Fatos (MV PostgreSQL + cache L1) e dimensões (ETL / persistência Prisma). */
@Injectable()
export class DatahubDwStore implements OnModuleInit {
  private readonly logger = new Logger(DatahubDwStore.name);

  fatos: Partial<Record<NomeFato, Record<string, unknown>[]>> = {};
  dimensoes: Partial<Record<NomeDim, Record<string, unknown>[]>> = {};
  ultimaCargaEm: string | null = null;

  private fatoCacheLoadedAt: number | null = null;
  private reloadInFlight: Promise<void> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCtx: TenantContextService,
  ) {}

  private tenantId() {
    return resolveStoreTenantId(this.tenantCtx);
  }

  private isFatoCacheFresh(): boolean {
    if (this.fatoCacheLoadedAt == null) return false;
    return Date.now() - this.fatoCacheLoadedAt < DATAHUB_L1_CACHE_TTL_MS;
  }

  async onModuleInit() {
    try {
      await this.hydrateDimensoesFromDb();
      await this.reloadFatosFromMv(true);
    } catch (e) {
      this.logger.warn(`Datahub DW hydrate omitido: ${(e as Error).message}`);
    }
  }

  /** Garante fatos frescos no cache L1 (TTL 5 min). */
  async ensureFatosFresh(): Promise<void> {
    if (this.isFatoCacheFresh()) return;
    await this.reloadFatosFromMv(false);
  }

  /** Recarrega fatos das materialized views para o cache L1. */
  async reloadFatosFromMv(force: boolean): Promise<void> {
    if (!force && this.isFatoCacheFresh()) return;
    if (this.reloadInFlight) {
      await this.reloadInFlight;
      return;
    }

    this.reloadInFlight = this.doReloadFatosFromMv();
    try {
      await this.reloadInFlight;
    } finally {
      this.reloadInFlight = null;
    }
  }

  private async doReloadFatosFromMv(): Promise<void> {
    const tenantId = this.tenantId();
    const fatos: DatahubDwStore['fatos'] = {};

    for (const [nomeFato, mv] of Object.entries(DATAHUB_FATO_TO_MV) as Array<
      [Exclude<NomeFato, 'FATO_RH_Folha'>, DatahubMvName]
    >) {
      try {
        const rows = await this.queryMvForTenant(mv, tenantId);
        fatos[nomeFato] = rows;
      } catch (e) {
        this.logger.warn(`MV ${mv} indisponível: ${(e as Error).message}`);
        fatos[nomeFato] = this.fatos[nomeFato] ?? [];
      }
    }

    this.fatos = { ...this.fatos, ...fatos };
    this.fatoCacheLoadedAt = Date.now();
    if (!this.ultimaCargaEm) {
      this.ultimaCargaEm = new Date().toISOString();
    }
  }

  private async queryMvForTenant(
    mv: DatahubMvName,
    tenantId: string,
  ): Promise<Record<string, unknown>[]> {
    const sql = `SELECT * FROM ${mv} WHERE tenant_id = $1`;
    const rows = await this.prisma.$queryRawUnsafe<Record<string, unknown>[]>(sql, tenantId);
    return rows.map((row) => this.normalizeMvRow(row));
  }

  private normalizeMvRow(row: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      if (v instanceof Date) {
        out[k] = v.toISOString();
      } else if (typeof v === 'bigint') {
        out[k] = Number(v);
      } else if (v != null && typeof v === 'object' && 'toNumber' in v) {
        out[k] = Number(v);
      } else {
        out[k] = v;
      }
    }
    return out;
  }

  private async hydrateDimensoesFromDb() {
    const tenantId = this.tenantId();
    const [dimRows, meta] = await Promise.all([
      this.prisma.datahubDimensao.findMany({ where: { tenantId } }),
      this.prisma.datahubDwMeta.findUnique({ where: { tenantId } }),
    ]);

    const dimensoes: DatahubDwStore['dimensoes'] = {};
    for (const row of dimRows) {
      const tipo = row.tipoDimensao as NomeDim;
      const arr = dimensoes[tipo] ?? [];
      arr.push(row.dados as Record<string, unknown>);
      dimensoes[tipo] = arr;
    }

    this.dimensoes = dimensoes;
    this.ultimaCargaEm = meta?.ultimaCargaEm?.toISOString() ?? this.ultimaCargaEm;
  }

  substituir(fatos: DatahubDwStore['fatos'], dimensoes: DatahubDwStore['dimensoes']) {
    this.dimensoes = { ...dimensoes };
    this.ultimaCargaEm = new Date().toISOString();
    void this.persistDimensoes(dimensoes).catch((e) =>
      this.logger.warn(`Datahub DW persist dims falhou: ${(e as Error).message}`),
    );
    void this.reloadFatosFromMv(true).catch((e) =>
      this.logger.warn(`Datahub DW reload MVs falhou: ${(e as Error).message}`),
    );
    if (fatos.FATO_RH_Folha?.length) {
      this.fatos = { ...this.fatos, FATO_RH_Folha: fatos.FATO_RH_Folha };
    }
  }

  limpar() {
    this.fatos = {};
    this.dimensoes = {};
    this.ultimaCargaEm = null;
    this.fatoCacheLoadedAt = null;
    void this.clearDb().catch((e) =>
      this.logger.warn(`Datahub DW limpar DB falhou: ${(e as Error).message}`),
    );
  }

  private async persistDimensoes(dimensoes: DatahubDwStore['dimensoes']) {
    const tenantId = this.tenantId();
    const ultimaCargaEm = this.ultimaCargaEm ? new Date(this.ultimaCargaEm) : new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.datahubDimensao.deleteMany({ where: { tenantId } });

      const dimCreates = Object.entries(dimensoes).flatMap(([tipoDimensao, rows]) =>
        (rows ?? []).map((dados, idx) => ({
          id: randomUUID(),
          tenantId,
          tipoDimensao,
          sk: extractSk(dados, `${tipoDimensao}_${idx}`),
          dados: dados as Prisma.InputJsonValue,
        })),
      );

      if (dimCreates.length) {
        await tx.datahubDimensao.createMany({ data: dimCreates });
      }

      await tx.datahubDwMeta.upsert({
        where: { tenantId },
        create: { tenantId, ultimaCargaEm },
        update: { ultimaCargaEm },
      });
    });
  }

  private async clearDb() {
    const tenantId = this.tenantId();
    await this.prisma.$transaction([
      this.prisma.datahubFato.deleteMany({ where: { tenantId } }),
      this.prisma.datahubDimensao.deleteMany({ where: { tenantId } }),
      this.prisma.datahubDwMeta.deleteMany({ where: { tenantId } }),
    ]);
  }
}
