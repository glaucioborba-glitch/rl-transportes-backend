import { disconnectPrisma, getPrisma } from './seed-utils';
import { normalizeTamanhosContainer } from '../src/cadastros/tipo-container-tamanhos.util';

const prisma = getPrisma();

async function main() {
  const rows = await prisma.cadastroTipoContainer.findMany({ where: { deletedAt: null } });
  let n = 0;
  for (const row of rows) {
    const clean = normalizeTamanhosContainer(row.tamanhos);
    const before = JSON.stringify(row.tamanhos);
    const after = JSON.stringify(clean);
    if (before !== after) {
      await prisma.cadastroTipoContainer.update({
        where: { id: row.id },
        data: { tamanhos: clean },
      });
      n++;
      console.log(`${row.codigo}: ${before} -> ${after}`);
    }
  }
  console.log(`Normalizados: ${n}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => disconnectPrisma());
