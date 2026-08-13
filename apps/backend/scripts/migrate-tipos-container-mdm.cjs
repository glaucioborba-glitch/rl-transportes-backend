const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');

/** Alinha containers_solicitacao.tipo ao cadastro MDM atual. */
const MAP = {
  DRY: 'DRYDC',
  DC: 'DRYDC',
  HC: 'DRYHC',
  OT: 'OPENTOP',
  FR: 'FLATRACK',
  TANK: 'ISOTANK',
};

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL missing');
  const pool = new Pool({ connectionString: url });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    for (const [from, to] of Object.entries(MAP)) {
      const r = await prisma.containerSolicitacao.updateMany({
        where: { tipo: from },
        data: { tipo: to },
      });
      console.log(`${from} → ${to}: ${r.count}`);
    }
    // Normaliza tamanhos legados 20DC/40HC → 20'/40'
    for (const [from, to] of [
      ['20DC', "20'"],
      ['40DC', "40'"],
      ['40HC', "40'"],
      ['45HC', "45'"],
      ['20', "20'"],
      ['40', "40'"],
      ['45', "45'"],
    ]) {
      const r = await prisma.containerSolicitacao.updateMany({
        where: { tamanho: from },
        data: { tamanho: to },
      });
      if (r.count) console.log(`tamanho ${from} → ${to}: ${r.count}`);
    }
    const left = await prisma.containerSolicitacao.groupBy({ by: ['tipo'], _count: true });
    console.log('tipos restantes', JSON.stringify(left));
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
