import { Injectable } from '@nestjs/common';
import type { PlataformaServicoId } from '../../plataforma-integracao/plataforma.types';
import { ConfigCacheService } from '../../common/cache/config-cache.service';
import { PrismaService } from '../../prisma/prisma.service';

/** Preferências de marketplace CX — PostgreSQL + cache Redis. */
@Injectable()
export class PortalMarketplaceCxStore {
  private readonly prefix = 'cx:mkt';

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: ConfigCacheService,
  ) {}

  private cacheKey(tenantId: string, sub: string) {
    return this.cache.key(this.prefix, `${tenantId}:${sub}`);
  }

  async obter(tenantId: string, sub: string): Promise<PlataformaServicoId[]> {
    const ck = this.cacheKey(tenantId, sub);
    const cached = await this.cache.get<PlataformaServicoId[]>(ck);
    if (cached) return cached;
    const row = await this.prisma.cxPortalMarketplacePreference.findUnique({
      where: { tenantId_sub: { tenantId, sub } },
    });
    const servicos = (row?.servicos as PlataformaServicoId[] | undefined) ?? [];
    await this.cache.set(ck, servicos);
    return [...servicos];
  }

  async definir(tenantId: string, sub: string, servico: PlataformaServicoId, ativo: boolean) {
    const current = new Set(await this.obter(tenantId, sub));
    if (ativo) current.add(servico);
    else current.delete(servico);
    const servicos = [...current] as PlataformaServicoId[];
    await this.prisma.cxPortalMarketplacePreference.upsert({
      where: { tenantId_sub: { tenantId, sub } },
      create: { tenantId, sub, servicos },
      update: { servicos },
    });
    await this.cache.set(this.cacheKey(tenantId, sub), servicos);
    return servicos;
  }
}
