export type HealthDatabaseStatus = 'ok' | 'offline';
export type HealthRedisStatus = 'ok' | 'offline';
export type HealthSecurityEngineStatus = 'ok' | 'degraded' | 'offline';

export type UnifiedHealthResponse = {
  api: 'ok';
  database: HealthDatabaseStatus;
  redis: HealthRedisStatus;
  securityEngine: HealthSecurityEngineStatus;
  /** Prefeitura (IPM): fora do /health público para não derrubar o load balancer. */
  fiscalIpm?: { status: 'ok' | 'offline'; detalhe?: string };
  timestamp: string;
  terminus?: unknown;
  crons?: Record<string, { ok: boolean; at: string; error?: string }>;
};
