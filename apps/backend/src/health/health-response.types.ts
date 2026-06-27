export type HealthDatabaseStatus = 'ok' | 'offline';
export type HealthRedisStatus = 'ok' | 'offline';
export type HealthSecurityEngineStatus = 'ok' | 'degraded' | 'offline';

export type UnifiedHealthResponse = {
  api: 'ok';
  database: HealthDatabaseStatus;
  redis: HealthRedisStatus;
  securityEngine: HealthSecurityEngineStatus;
  timestamp: string;
  terminus?: unknown;
};
