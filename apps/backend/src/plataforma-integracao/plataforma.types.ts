/** Tipos Fase 18 — plataforma-integração (sem migrations; estado em memória + Prisma read-only). */

export type PlataformaServicoId =
  | 'tracking_operacional'
  | 'tracking_financeiro'
  | 'sla_service'
  | 'ciclo_operacional'
  | 'patio_tempo_real'
  | 'produtividade_stats'
  | 'eventos_fiscal_financeiro'
  | 'faturamento_pagamentos';

export interface PlataformaTenantConfig {
  slasHorasProxy: Record<string, number>;
  horarioFuncionamento: string;
  regrasOperacao: string;
}

export interface PlataformaTenant {
  id: string;
  nome: string;
  clienteIds: string[];
  config: PlataformaTenantConfig;
  createdAt: string;
}

export interface PlataformaApiClient {
  id: string;
  apiKey: string;
  secret: string;
  label: string;
  tenantId: string;
  clienteIds: string[];
  requestsPerMinute: number;
  enabled: boolean;
  servicosHabilitados: PlataformaServicoId[];
}

export interface ConsumoRegistro {
  id: string;
  apiClientId: string;
  rota: string;
  metodo: string;
  statusHttp: number;
  latencyMs: number;
  tenantId: string | null;
  criadoEm: string;
}

export interface WebhookContratoDef {
  evento: string;
  descricao: string;
  payloadSchemaRef: string;
}
