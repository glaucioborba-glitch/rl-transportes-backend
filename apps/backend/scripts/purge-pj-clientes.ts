import * as path from 'node:path';
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role, TipoCliente } from '@prisma/client';
import { Pool } from 'pg';

config({ path: path.resolve(__dirname, '../../../.env') });

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL não definido (carregue o .env da raiz do monorepo).');
}

const pool = new Pool({ connectionString: url });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const pjs = await prisma.cliente.findMany({
    where: { tipo: TipoCliente.PJ },
    select: { id: true, cpfCnpj: true, razaoSocial: true },
  });

  console.log(`Clientes PJ encontrados: ${pjs.length}`);
  for (const c of pjs) {
    console.log(`  - ${c.cpfCnpj}  ${c.razaoSocial}`);
  }

  const pjIds = pjs.map((c) => c.id);
  const pjDocs = pjs.map((c) => c.cpfCnpj);

  const delUsers =
    pjIds.length || pjDocs.length
      ? await prisma.user.deleteMany({
          where: {
            OR: [
              ...(pjIds.length ? [{ role: Role.CLIENTE, clienteId: { in: pjIds } }] : []),
              ...(pjDocs.length ? [{ role: Role.CLIENTE, cpfCnpj: { in: pjDocs } }] : []),
            ],
          },
        })
      : { count: 0 };

  const delClientes = await prisma.cliente.deleteMany({
    where: { tipo: TipoCliente.PJ },
  });

  console.log(`Usuários portal removidos: ${delUsers.count}`);
  console.log(`Clientes PJ removidos: ${delClientes.count}`);
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
