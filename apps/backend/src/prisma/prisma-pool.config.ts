import type { PoolConfig } from 'pg';

const DEFAULT_POOL_MAX = 20;
const DEFAULT_IDLE_MS = 30_000;
const DEFAULT_CONN_TIMEOUT_MS = 30_000;

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = raw ? parseInt(raw, 10) : fallback;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Detecta uso de PgBouncer (porta 6432 ou flag explícita). */
export function isPgBouncerEnabled(connectionString: string): boolean {
  const flag = process.env.PGBOUNCER?.trim().toLowerCase();
  if (flag === '1' || flag === 'true' || flag === 'yes') return true;
  try {
    const normalized = connectionString.replace(/^postgresql:/, 'http:');
    const port = new URL(normalized).port;
    return port === '6432';
  } catch {
    return false;
  }
}

/** Opções do pool `pg` alinhadas ao PgBouncer (PR-24). */
export function buildPgPoolConfig(connectionString: string): PoolConfig {
  const viaPgBouncer = isPgBouncerEnabled(connectionString);
  const max = parsePositiveInt(process.env.DATABASE_POOL_MAX, DEFAULT_POOL_MAX);
  const idleTimeoutMillis = parsePositiveInt(process.env.DATABASE_POOL_IDLE_MS, DEFAULT_IDLE_MS);
  const connectionTimeoutMillis = parsePositiveInt(
    process.env.DATABASE_POOL_TIMEOUT_MS,
    DEFAULT_CONN_TIMEOUT_MS,
  );

  const config: PoolConfig = {
    connectionString,
    max: viaPgBouncer ? Math.min(max, 25) : max,
    idleTimeoutMillis,
    connectionTimeoutMillis,
    allowExitOnIdle: false,
  };

  // Transaction pooling do PgBouncer não suporta prepared statements persistentes.
  if (viaPgBouncer) {
    (config as PoolConfig & { statement_timeout?: number }).statement_timeout = connectionTimeoutMillis;
  }

  return config;
}
