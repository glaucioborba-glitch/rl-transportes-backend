import { createHash, randomUUID, timingSafeEqual } from 'crypto';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PlataformaApiClient, PlataformaServicoId } from '../plataforma.types';

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
  private readonly clientsById = new Map<string, PlataformaApiClient>();
  private readonly byKey = new Map<string, string>();

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const raw =
      process.env.PLATAFORMA_API_CLIENTS ??
      this.config.get<string>('PLATAFORMA_API_CLIENTS') ??
      'demo-pk|demo-sk|Cliente demo API|default|240';
    for (const row of parseBootstrap(raw)) {
      this.registrarInterno(row);
    }
  }

  private registrarInterno(row: Omit<PlataformaApiClient, 'id'>): PlataformaApiClient {
    const id = randomUUID();
    const full: PlataformaApiClient = { id, ...row };
    this.clientsById.set(id, full);
    this.byKey.set(full.apiKey, id);
    return full;
  }

  /** ADMIN — cria parceiro/API corporativa. */
  criarClienteApi(row: Omit<PlataformaApiClient, 'id'>): PlataformaApiClient {
    if (this.byKey.has(row.apiKey)) {
      throw new Error('API Key já existente');
    }
    return this.registrarInterno(row);
  }

  listar(): PlataformaApiClient[] {
    return [...this.clientsById.values()];
  }

  obterPorId(id: string): PlataformaApiClient | undefined {
    return this.clientsById.get(id);
  }

  obterPorApiKey(apiKey: string): PlataformaApiClient | undefined {
    const id = this.byKey.get(apiKey.trim());
    return id ? this.clientsById.get(id) : undefined;
  }

  validarSecret(client: PlataformaApiClient, secret: string): boolean {
    const a = createHash('sha256').update(client.secret).digest();
    const b = createHash('sha256').update(secret).digest();
    return timingSafeEqual(a, b);
  }

  /** Atualiza serviços habilitados (marketplace). */
  atualizarServicos(id: string, servicos: PlataformaServicoId[]): PlataformaApiClient | undefined {
    const c = this.clientsById.get(id);
    const uniq = [...new Set(servicos)] as PlataformaServicoId[];
    if (!c) return undefined;
    c.servicosHabilitados = uniq;
    return c;
  }

  temServico(client: PlataformaApiClient, servico: PlataformaServicoId): boolean {
    return client.servicosHabilitados.includes(servico);
  }
}
