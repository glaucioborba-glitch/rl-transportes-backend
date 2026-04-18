import * as path from 'node:path';
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { Pool } from 'pg';

config({ path: path.resolve(__dirname, '../../../.env') });

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL não definido (carregue o .env da raiz do monorepo).');
}

const pool = new Pool({ connectionString: url });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@rltransportes.com';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123';
  const hash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    create: {
      email,
      password: hash,
      role: Role.ADMIN,
    },
    update: {
      password: hash,
      role: Role.ADMIN,
    },
  });

  console.log(`Seed OK: usuário admin ${email} (altere a senha em produção).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
