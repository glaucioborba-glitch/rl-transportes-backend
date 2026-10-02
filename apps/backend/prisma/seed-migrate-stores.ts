import * as path from 'node:path';
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

config({ path: path.resolve(__dirname, '../../../.env') });

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL não definido');

const pool = new Pool({ connectionString: url });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const count = await prisma.grcRisco.count();
  if (count > 0) {
    console.log(`[seed-migrate-stores] grc_riscos já possui ${count} registro(s) — skip (sem migração de memória).`);
    return;
  }
  console.log('[seed-migrate-stores] grc_riscos vazio — nenhuma migração de dados em memória necessária.');
}

main()
  .catch((e) => {
    console.error('[seed-migrate-stores] falhou:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
