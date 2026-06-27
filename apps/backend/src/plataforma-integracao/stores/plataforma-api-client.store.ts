import { createHash, randomUUID, timingSafeEqual } from 'crypto';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PlataformaApiClient, PlataformaServicoId } from '../plataforma.types';
import { ConfigCacheService } from '../../common/cache/config-cache.service';
import { PrismaService } from '../../prisma/prisma.service';

const TODOS_SERVICOS: PlataformaServicoId[] = [
  'tracking_operacional',
  'tracking_financeiro',
  'sla_service',
  'ciclo_operacional',
  'patio_tempo_real',
  'produtividade_stats',
  'eventos_fiscal_financeiro',
  'faturamento_pagamentos',
];

function parseBootstrap(raw: string): Omit<PlataformaApiClient, 'id'>[] {
  const out: Omit<PlataformaApiClient, 'id'>[] = [];
  for (const chunk of raw.split(';').map((s) => s.trim()).filter(Boolean)) {
    const [apiKey, secret, label, tenantId, rpm, clientes] = chunk.split('|').map((s) => s.trim());
    if (!apiKey || !secret) continue;
    const ids = (clientes ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    out.push({
      apiKey,
      secret,
      label: label || 'bootstrap',
      tenantId: tenantId || 'default',
      clienteIds: ids,
      requestsPerMinute: Math.max(10, parseInt(rpm || '120', 10) || 120),
      enabled: true,
      servicosHabilitados: [...TODOS_SERVICOS],
    });
  }
  return out;
}

@Injectable()
export class PlataformaApiClientStore implements OnModuleInit {
  private readonly prefix = 'plt:api';

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly cache: ConfigCacheService,
  ) {}

  async onModuleInit() {
    const raw =
      process.env.PLATAFORMA_API_CLIENTS ??
      this.config.get<string>('PLATAFORMA_API_CLIENTS') ??
      'demo-pk|demo-sk|Cliente demo API|default|240';
    for (const row of parseBootstrap(raw)) {
      await this.prisma.plataformaApiClientRecord.upsert({
        where: { apiKey: row.apiKey },
        create: {
          id: randomUUID(),
          apiKey: row.apiKey,
          secret: row.secret,
          label: row.label,
          tenantId: row.tenantId,
          clienteIds: row.clienteIds,
          requestsPerMinute: row.requestsPerMinute,
          enabled: row.enabled,
          servicosHabilitados: row.servicosHabilitados,
        },
        update: {
          secret: row.secret,
          label: row.label,
          tenantId: row.tenantId,
          clienteIds: row.clienteIds,
          requestsPerMinute: row.requestsPerMinute,
          enabled: row.enabled,
          servicosHabilitados: row.servicosHabilitados,
        },
      });
      await this.cache.invalidate(this.cache.key(this.prefix, row.apiKey));
    }
  }

  private mapRow(row: {
    id: string;
    apiKey: string;
    secret: string;
    label: string;
    tenantId: string;
    clienteIds: unknown;
    requestsPerMinute: number;
    enabled: boolean;
    servicosHabilitados: unknown;
  }): PlataformaApiClient {
    return {
      id: row.id,
      apiKey: row.apiKey,
      secret: row.secret,
      label: row.label,
      tenantId: row.tenantId,
      clienteIds: (row.clienteIds as string[]) ?? [],
      requestsPerMinute: row.requestsPerMinute,
      enabled: row.enabled,
      servicosHabilitados: (row.servicosHabilitados as PlataformaServicoId[]) ?? [],
    };
  }

  private async loadByApiKey(apiKey: string): Promise<PlataformaApiClient | undefined> {
    const ck = this.cache.key(this.prefix, apiKey.trim());
    const cached = await this.cache.get<PlataformaApiClient>(ck);
    if (cached) return cached;
    const row = await this.prisma.plataformaApiClientRecord.findUnique({
      where: { apiKey: apiKey.trim() },
    });
    if (!row) return undefined;
    const mapped = this.mapRow(row);
    await this.cache.set(ck, mapped);
    return mapped;
  }

  /** ADMIN — cria parceiro/API corporativa. */
  async criarClienteApi(row: Omit<PlataformaApiClient, 'id'>): Promise<PlataformaApiClient> {
    const existing = await this.prisma.plataformaApiClientRecord.findUnique({
      where: { apiKey: row.apiKey },
    });
    if (existing) throw new Error('API Key já existente');
    const created = await this.prisma.plataformaApiClientRecord.create({
      data: {
        id: randomUUID(),
        apiKey: row.apiKey,
        secret: row.secret,
        label: row.label,
        tenantId: row.tenantId,
        clienteIds: row.clienteIds,
        requestsPerMinute: row.requestsPerMinute,
        enabled: row.enabled,
        servicosHabilitados: row.servicosHabilitados,
      },
    });
    const mapped = this.mapRow(created);
    await this.cache.set(this.cache.key(this.prefix, row.apiKey), mapped);
    return mapped;
  }

  async listar(): Promise<PlataformaApiClient[]> {
    const rows = await this.prisma.plataformaApiClientRecord.findMany({ orderBy: { createdAt: 'asc' } });
    return rows.map((r) => this.mapRow(r));
  }

  async obterPorId(id: string): Promise<PlataformaApiClient | undefined> {
    const row = await this.prisma.plataformaApiClientRecord.findUnique({ where: { id } });
    return row ? this.mapRow(row) : undefined;
  }

  async obterPorApiKey(apiKey: string): Promise<PlataformaApiClient | undefined> {
    return this.loadByApiKey(apiKey);
  }

  validarSecret(client: PlataformaApiClient, secret: string): boolean {
    const a = createHash('sha256').update(client.secret).digest();
    const b = createHash('sha256').update(secret).digest();
    return timingSafeEqual(a, b);
  }

  /** Atualiza serviços habilitados (marketplace). */
  async atualizarServicos(
    id: string,
    servicos: PlataformaServicoId[],
  ): Promise<PlataformaApiClient | undefined> {
    const uniq = [...new Set(servicos)] as PlataformaServicoId[];
    const row = await this.prisma.plataformaApiClientRecord.update({
      where: { id },
      data: { servicosHabilitados: uniq },
    });
    const mapped = this.mapRow(row);
    await this.cache.invalidate(this.cache.key(this.prefix, row.apiKey));
    return mapped;
  }

  temServico(client: PlataformaApiClient, servico: PlataformaServicoId): boolean {
    return client.servicosHabilitados.includes(servico);
  }
}
