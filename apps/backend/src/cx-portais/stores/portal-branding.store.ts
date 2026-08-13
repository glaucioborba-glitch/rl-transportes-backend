import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigCacheService } from '../../common/cache/config-cache.service';
import { PrismaService } from '../../prisma/prisma.service';

export type PortalBrandingConfig = {
  id: string;
  tenantId: string;
  cores: { primaria: string; secundaria: string };
  logoUrl?: string;
  tema: 'light' | 'dark';
  menuItens: string[];
  slasExibidos: string[];
  kpisExibidos: string[];
  atualizadoEm: string;
};

const DEFAULTS = (tenantId: string): PortalBrandingConfig => ({
  id: 'default',
  tenantId,
  cores: { primaria: '#0d6efd', secundaria: '#6c757d' },
  tema: 'light',
  menuItens: ['dashboard', 'solicitacoes', 'financeiro', 'slas', 'kpis', 'chamados'],
  slasExibidos: ['gate', 'patio', 'saida'],
  kpisExibidos: ['ciclo_medio_horas', 'containers_ativos', 'faturamento_aberto'],
  atualizadoEm: new Date().toISOString(),
});

@Injectable()
export class PortalBrandingStore {
  private readonly prefix = 'cx:brand';

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: ConfigCacheService,
  ) {}

  private mapRow(row: {
    id: string;
    tenantId: string;
    cores: unknown;
    logoUrl: string | null;
    tema: string;
    menuItens: unknown;
    slasExibidos: unknown;
    kpisExibidos: unknown;
    updatedAt: Date;
  }): PortalBrandingConfig {
    const cores = row.cores as { primaria: string; secundaria: string };
    return {
      id: row.id,
      tenantId: row.tenantId,
      cores,
      logoUrl: row.logoUrl ?? undefined,
      tema: row.tema === 'dark' ? 'dark' : 'light',
      menuItens: row.menuItens as string[],
      slasExibidos: row.slasExibidos as string[],
      kpisExibidos: row.kpisExibidos as string[],
      atualizadoEm: row.updatedAt.toISOString(),
    };
  }

  async obter(tenantId: string): Promise<PortalBrandingConfig> {
    const ck = this.cache.key(this.prefix, tenantId);
    const cached = await this.cache.get<PortalBrandingConfig>(ck);
    if (cached) return cached;
    const row = await this.prisma.cxPortalBrandingConfig.findUnique({ where: { tenantId } });
    if (!row) return DEFAULTS(tenantId);
    const mapped = this.mapRow(row);
    await this.cache.set(ck, mapped);
    return mapped;
  }

  async salvar(
    tenantId: string,
    patch: Partial<Omit<PortalBrandingConfig, 'id' | 'tenantId' | 'atualizadoEm'>>,
  ): Promise<PortalBrandingConfig> {
    const prev = await this.obter(tenantId);
    const next: PortalBrandingConfig = {
      ...prev,
      ...patch,
      id: prev.id === 'default' ? randomUUID() : prev.id,
      tenantId,
      atualizadoEm: new Date().toISOString(),
    };
    const row = await this.prisma.cxPortalBrandingConfig.upsert({
      where: { tenantId },
      create: {
        id: next.id,
        tenantId,
        cores: next.cores,
        logoUrl: next.logoUrl ?? null,
        tema: next.tema,
        menuItens: next.menuItens,
        slasExibidos: next.slasExibidos,
        kpisExibidos: next.kpisExibidos,
      },
      update: {
        cores: next.cores,
        logoUrl: next.logoUrl ?? null,
        tema: next.tema,
        menuItens: next.menuItens,
        slasExibidos: next.slasExibidos,
        kpisExibidos: next.kpisExibidos,
      },
    });
    const mapped = this.mapRow(row);
    await this.cache.set(this.cache.key(this.prefix, tenantId), mapped);
    return mapped;
  }
}
