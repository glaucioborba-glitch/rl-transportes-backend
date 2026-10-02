import { buildPgPoolConfig, isPgBouncerEnabled } from './prisma-pool.config';

describe('prisma-pool.config', () => {
  const directUrl = 'postgresql://postgres:postgres@localhost:5433/rl?schema=public';
  const pgbouncerUrl = 'postgresql://postgres:postgres@localhost:6432/rl?schema=public';

  afterEach(() => {
    delete process.env.PGBOUNCER;
    delete process.env.DATABASE_POOL_MAX;
  });

  it('detecta PgBouncer pela porta 6432', () => {
    expect(isPgBouncerEnabled(pgbouncerUrl)).toBe(true);
    expect(isPgBouncerEnabled(directUrl)).toBe(false);
  });

  it('detecta PgBouncer pela flag PGBOUNCER=1', () => {
    process.env.PGBOUNCER = '1';
    expect(isPgBouncerEnabled(directUrl)).toBe(true);
  });

  it('limita pool max a 25 via PgBouncer', () => {
    process.env.DATABASE_POOL_MAX = '50';
    const cfg = buildPgPoolConfig(pgbouncerUrl);
    expect(cfg.max).toBe(25);
  });

  it('usa DATABASE_POOL_MAX em conexão direta', () => {
    process.env.DATABASE_POOL_MAX = '30';
    const cfg = buildPgPoolConfig(directUrl);
    expect(cfg.max).toBe(30);
  });
});
