import * as path from 'node:path';
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '@prisma/client';
import { Pool } from 'pg';

config({ path: path.resolve(__dirname, '../../../.env') });

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL não definido (carregue o .env da raiz do monorepo).');
}

const pool = new Pool({ connectionString: url });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const antes = await prisma.cliente.findMany({
    select: { id: true, cpfCnpj: true, razaoSocial: true, tipo: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Clientes no banco antes da limpeza: ${antes.length}`);
  for (const c of antes) {
    console.log(`  - [${c.tipo}] ${c.cpfCnpj}  ${c.razaoSocial}`);
  }

  const delUsers = await prisma.user.deleteMany({ where: { role: Role.CLIENTE } });
  const delClientes = await prisma.cliente.deleteMany({});

  console.log(`Usuários CLIENTE removidos: ${delUsers.count}`);
  console.log(`Clientes (PF + PJ) removidos: ${delClientes.count}`);
  console.log('Pronto para novos cadastros de teste.');
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
