import * as path from 'node:path';
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '@prisma/client';
import { Pool } from 'pg';

config({ path: path.resolve(__dirname, '../../../.env') });

const cnpj = (process.argv[2] ?? '').replace(/\D/g, '');
if (cnpj.length !== 14) {
  console.error('Uso: npx ts-node scripts/purge-cliente-by-cnpj.ts <CNPJ 14 dígitos>');
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL não definido (carregue o .env da raiz do monorepo).');
}

const pool = new Pool({ connectionString: url });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const cliente = await prisma.cliente.findFirst({
    where: { cpfCnpj: cnpj },
    select: { id: true, cpfCnpj: true, razaoSocial: true, tipo: true, email: true },
  });

  if (!cliente) {
    console.log(`Nenhum cliente encontrado com CNPJ/CPF ${cnpj}.`);
    return;
  }

  console.log(`Removendo: [${cliente.tipo}] ${cliente.cpfCnpj} — ${cliente.razaoSocial} (${cliente.email})`);

  const users = await prisma.user.findMany({
    where: {
      OR: [{ clienteId: cliente.id }, { cpfCnpj: cnpj, role: Role.CLIENTE }],
    },
    select: { id: true, email: true },
  });

  if (users.length) {
    const userIds = users.map((u) => u.id);
    const delResets = await prisma.portalPasswordReset.deleteMany({
      where: { userId: { in: userIds } },
    });
    const delUsers = await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    console.log(`  Tokens de reset removidos: ${delResets.count}`);
    console.log(`  Usuários portal removidos: ${delUsers.count}`);
  }

  await prisma.cliente.delete({ where: { id: cliente.id } });
  console.log('Cliente e dependências (cascade) removidos.');
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
