/**
 * Detecta divergências entre schema Prisma e banco físico (P2009/P2021 em runtime).
 * Uso: npm run db:validate-schema
 */
import { disconnectPrisma, getPrisma } from './seed-utils';

const prisma = getPrisma();

type DriftIssue = { type: string; detail: string };

async function validate(): Promise<DriftIssue[]> {
  const drift: DriftIssue[] = [];

  const dbTables = await prisma.$queryRaw<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `;
  const dbTableNames = dbTables.map((t) => t.table_name);

  const checks: { table: string; column: string | null }[] = [
    { table: 'clientes', column: 'data_nascimento' },
    { table: 'solicitacao_anexos', column: null },
    { table: 'solicitante_contato', column: null },
    { table: 'transporte_solicitacao', column: null },
  ];

  for (const check of checks) {
    if (!dbTableNames.includes(check.table)) {
      drift.push({ type: 'MISSING_TABLE', detail: `Tabela '${check.table}' ausente no banco` });
      continue;
    }
    if (check.column) {
      const cols = await prisma.$queryRaw<{ column_name: string }[]>`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = ${check.table} AND table_schema = 'public'
      `;
      if (!cols.map((c) => c.column_name).includes(check.column)) {
        drift.push({
          type: 'MISSING_COLUMN',
          detail: `Coluna '${check.column}' ausente em '${check.table}'`,
        });
      }
    }
  }

  const enumValues = await prisma.$queryRaw<{ enumlabel: string }[]>`
    SELECT enumlabel FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'OutboxEventStatus'
  `;
  if (!enumValues.map((v) => v.enumlabel).includes('PROCESSING')) {
    drift.push({
      type: 'MISSING_ENUM_VALUE',
      detail: "Valor 'PROCESSING' ausente no enum OutboxEventStatus",
    });
  }

  return drift;
}

async function main() {
  const drift = await validate();
  if (drift.length === 0) {
    console.log('✅ Schema drift: NENHUM detectado');
    process.exit(0);
  }
  console.error(`❌ Schema drift: ${drift.length} problema(s) detectado(s):`);
  for (const d of drift) {
    console.error(`  [${d.type}] ${d.detail}`);
  }
  process.exit(1);
}

main()
  .catch((err) => {
    console.error('Falha ao validar schema drift:', err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => disconnectPrisma());
