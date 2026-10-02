/** Domínios isolados para circuit breaker / timeouts / fallback. */
export type ResilienceServiceKey =
  | 'security'
  | 'portal'
  | 'financeiro'
  | 'agendamentos'
  | 'auditoria'
  | 'core';

export type CircuitBreakerConfig = {
  windowMs: number;
  threshold: number;
  cooldownMs: number;
  halfOpenRetry: number;
};

export const DEFAULT_CB_CONFIG: CircuitBreakerConfig = {
  windowMs: 10_000,
  threshold: 5,
  cooldownMs: 30_000,
  halfOpenRetry: 1,
};

/** Mais específico primeiro (prefix match). */
export const RESILIENCE_ROUTE_RULES: Array<{
  prefix: string;
  service: ResilienceServiceKey;
  timeoutMs: number;
}> = [
  { prefix: '/cliente/security', service: 'security', timeoutMs: 1500 },
  { prefix: '/v1/agendamentos', service: 'agendamentos', timeoutMs: 1200 },
  { prefix: '/cliente/portal/financeiro', service: 'financeiro', timeoutMs: 1200 },
  { prefix: '/cliente/portal/solicitacoes', service: 'agendamentos', timeoutMs: 1200 },
  /** Dashboard agrega várias queries Prisma — timeout maior evita fallback prematuro. */
  { prefix: '/cliente/portal/dashboard', service: 'portal', timeoutMs: 12_000 },
  { prefix: '/cliente/portal', service: 'portal', timeoutMs: 1200 },
  { prefix: '/auditoria', service: 'auditoria', timeoutMs: 900 },
];

/** Redis — estado do circuito por serviço (valor JSON). */
export function circuitStateKey(service: ResilienceServiceKey): string {
  return `cb:${service}:state`;
}

export const RES_MET_FALLBACK_COUNT = 'res:v1:fallback:count';
export const RES_MET_CB_OPEN_MS = 'res:v1:cb:open:ms';
export const RES_MET_TIMELINE = 'res:v1:cb:timeline';
export const RES_MET_RECOVERY_LOG = 'res:v1:recovery:log';
