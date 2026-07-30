import { randomUUID } from 'crypto';
import { Injectable, OnModuleInit } from '@nestjs/common';
import type { PlataformaTenant, PlataformaTenantConfig } from '../plataforma.types';
import { ConfigCacheService } from '../../common/cache/config-cache.service';
import { PrismaService } from '../../prisma/prisma.service';
import { DEFAULT_TENANT_PARAMETROS } from '../../tenant/tenant-config.types';
import { DEFAULT_TENANT_ID } from '../../tenant/tenant.constants';

const defaultConfig: PlataformaTenantConfig = {
  slasMinutosMeta: { gate: 240, patio: 4320, saida: 1440 },
  horarioFuncionamento: '06:00–22:00 UTC',
  regrasOperacao: 'Padrão corporativo (simulado Fase 18).',
};

@Injectable()
export class PlataformaTenantStore implements OnModuleInit {
  private readonly prefix = 'plt:tenant';

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: ConfigCacheService,
  ) {}

  async onModuleInit() {
    await this.prisma.tenant.upsert({
      where: { id: DEFAULT_TENANT_ID },
      create: {
        id: DEFAULT_TENANT_ID,
        slug: DEFAULT_TENANT_ID,
        nome: 'Terminal corporativo (default)',
      },
      update: {},
    });

    await this.prisma.tenantConfig.upsert({
      where: { tenantId: DEFAULT_TENANT_ID },
      create: {
        tenantId: DEFAULT_TENANT_ID,
        tenantKey: DEFAULT_TENANT_ID,
        nome: 'Terminal corporativo (default)',
        parametros: DEFAULT_TENANT_PARAMETROS as object,
        clienteIds: [],
        slasMinutosMeta: defaultConfig.slasMinutosMeta,
        horarioFuncionamento: defaultConfig.horarioFuncionamento,
        regrasOperacao: 'Tenant default — sem segregação de clientes até configurar.',
      },
      update: {},
    });
  }

  private mapRow(row: {
    id: string;
    tenantId: string;
    tenantKey: string;
    nome: string;
    clienteIds: unknown;
    slasMinutosMeta: unknown;
    horarioFuncionamento: string;
    regrasOperacao: string;
    createdAt: Date;
  }): PlataformaTenant {
    return {
      id: row.tenantKey,
      nome: row.nome,
      clienteIds: (row.clienteIds as string[]) ?? [],
      config: {
        slasMinutosMeta: row.slasMinutosMeta as Record<string, number>,
        horarioFuncionamento: row.horarioFuncionamento,
        regrasOperacao: row.regrasOperacao,
      },
      createdAt: row.createdAt.toISOString(),
    };
  }

  async listar(): Promise<PlataformaTenant[]> {
    const rows = await this.prisma.tenantConfig.findMany({ orderBy: { createdAt: 'asc' } });
    return rows.map((r) => this.mapRow(r));
  }

  async obter(id: string): Promise<PlataformaTenant | undefined> {
    const ck = this.cache.key(this.prefix, id);
    const cached = await this.cache.get<PlataformaTenant>(ck);
    if (cached) return cached;
    const row = await this.prisma.tenantConfig.findFirst({
      where: { OR: [{ tenantKey: id }, { tenantId: id }] },
    });
    if (!row) return undefined;
    const mapped = this.mapRow(row);
    await this.cache.set(ck, mapped);
    return mapped;
  }

  async criar(
    nome: string,
    clienteIds: string[],
    config?: Partial<PlataformaTenantConfig>,
  ): Promise<PlataformaTenant> {
    const id = randomUUID();
    const merged: PlataformaTenantConfig = { ...defaultConfig, ...config };
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.tenant.create({
        data: { id, slug: id, nome },
      });
      return tx.tenantConfig.create({
        data: {
          tenantId: id,
          tenantKey: id,
          nome,
          parametros: DEFAULT_TENANT_PARAMETROS as object,
          clienteIds: [...new Set(clienteIds)],
          slasMinutosMeta: merged.slasMinutosMeta,
          horarioFuncionamento: merged.horarioFuncionamento,
          regrasOperacao: merged.regrasOperacao,
        },
      });
    });
    const mapped = this.mapRow(row);
    await this.cache.set(this.cache.key(this.prefix, id), mapped);
    return mapped;
  }
}
