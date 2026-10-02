import { config } from 'dotenv';
import { resolve } from 'node:path';
import { defineConfig } from 'prisma/config';

// Mesma ordem do Nest: .env na raiz do monorepo e opcional em apps/backend
config({ path: resolve(__dirname, '../../.env') });
config({ path: resolve(__dirname, '.env') });

/** URL só para CLI (migrate, introspect). Preferir DIRECT_URL (PostgreSQL direto, sem PgBouncer). */
const datasourceUrl =
  process.env.DIRECT_URL ??
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:5433/rl?schema=public';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'npx ts-node --compiler-options {"module":"CommonJS"} prisma/seed.ts',
  },
  datasource: {
    url: datasourceUrl,
  },
});
