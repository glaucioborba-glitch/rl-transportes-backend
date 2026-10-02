import { Injectable, Logger } from '@nestjs/common';
import type { FeatureFlag } from '@prisma/client';
import { ConfigCacheService } from '../common/cache/config-cache.service';
import { PrismaService } from '../prisma/prisma.service';
import type { FeatureFlagEvalContext, FeatureFlagKey, FeatureFlagRules } from './feature-flag.keys';

const CACHE_TTL_SEC = 60;

type MemEntry = { exp: number; value: FeatureFlag };

@Injectable()
export class FeatureFlagService {
  private readonly logger = new Logger(FeatureFlagService.name);
  private readonly mem = new Map<string, MemEntry>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: ConfigCacheService,
  ) {}

  private cacheKey(chave: string): string {
    return this.cache.key('feature-flag', chave);
  }

  private readMem(key: string): FeatureFlag | null {
    const hit = this.mem.get(key);
    if (!hit) return null;
    if (Date.now() > hit.exp) {
      this.mem.delete(key);
      return null;
    }
    return hit.value;
  }

  private writeMem(key: string, row: FeatureFlag): void {
    this.mem.set(key, { exp: Date.now() + CACHE_TTL_SEC * 1000, value: row });
  }

  private parseRules(raw: unknown): FeatureFlagRules {
    if (!raw || typeof raw !== 'object') return {};
    const r = raw as Record<string, unknown>;
    const cnpjAllowList = Array.isArray(r.cnpjAllowList)
      ? r.cnpjAllowList.map((x) => String(x).replace(/\D/g, '')).filter((x) => x.length === 14)
      : undefined;
    const tenantIds = Array.isArray(r.tenantIds)
      ? r.tenantIds.map((x) => String(x).trim()).filter(Boolean)
      : undefined;
    return { cnpjAllowList, tenantIds };
  }

  private matchesRules(ativo: boolean, rules: FeatureFlagRules, ctx?: FeatureFlagEvalContext): boolean {
    if (!ativo) return false;
    if (rules.cnpjAllowList?.length) {
      const doc = ctx?.cnpj?.replace(/\D/g, '') ?? '';
      if (!doc || !rules.cnpjAllowList.includes(doc)) return false;
    }
    if (rules.tenantIds?.length) {
      const tid = ctx?.tenantId?.trim() ?? '';
      if (!tid || !rules.tenantIds.includes(tid)) return false;
    }
    return true;
  }

  async findByChave(chave: string): Promise<FeatureFlag | null> {
    const key = this.cacheKey(chave);
    const memHit = this.readMem(key);
    if (memHit) return memHit;

    const cached = await this.cache.get<FeatureFlag>(key);
    if (cached) {
      this.writeMem(key, cached);
      return cached;
    }
    const row = await this.prisma.featureFlag.findUnique({ where: { chave } });
    if (row) {
      this.writeMem(key, row);
      await this.cache.set(key, row, CACHE_TTL_SEC);
    }
    return row;
  }

  async isEnabled(chave: FeatureFlagKey | string, ctx?: FeatureFlagEvalContext): Promise<boolean> {
    const row = await this.findByChave(chave);
    if (!row) {
      this.logger.debug(`Feature flag ${chave} ausente — default false`);
      return false;
    }
    const rules = this.parseRules(row.regras);
    return this.matchesRules(row.ativo, rules, ctx);
  }

  async listAll(): Promise<FeatureFlag[]> {
    return this.prisma.featureFlag.findMany({ orderBy: { chave: 'asc' } });
  }

  async upsert(
    chave: string,
    data: { ativo: boolean; regras?: FeatureFlagRules; descricao?: string },
  ): Promise<FeatureFlag> {
    const regras = data.regras ?? {};
    const row = await this.prisma.featureFlag.upsert({
      where: { chave },
      create: {
        chave,
        ativo: data.ativo,
        regras,
        descricao: data.descricao,
      },
      update: {
        ativo: data.ativo,
        regras,
        ...(data.descricao !== undefined ? { descricao: data.descricao } : {}),
      },
    });
    await this.cache.invalidate(this.cacheKey(chave));
    this.mem.delete(this.cacheKey(chave));
    return row;
  }

  async invalidateCache(chave: string): Promise<void> {
    await this.cache.invalidate(this.cacheKey(chave));
    this.mem.delete(this.cacheKey(chave));
  }
}
