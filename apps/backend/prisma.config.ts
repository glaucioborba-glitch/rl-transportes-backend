import { config } from 'dotenv';
import { resolve } from 'node:path';
import { defineConfig } from 'prisma/config';

// Mesma ordem do Nest: .env na raiz do monorepo e opcional em apps/backend
config({ path: resolve(__dirname, '../../.env') });
config({ path: resolve(__dirname, '.env') });

/** URL só para CLI (migrate, introspect). `prisma generate` não conecta ao banco. */
const datasourceUrl =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:5432/rl_transportes';

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
