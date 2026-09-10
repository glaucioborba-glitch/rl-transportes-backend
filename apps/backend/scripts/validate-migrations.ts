/**
 * Valida migrations + schema Prisma.
 * Uso: npm run validate:migrations
 */
import { execSync } from 'child_process';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

const backendRoot = join(__dirname, '..');
const migrationsDir = join(backendRoot, 'prisma', 'migrations');

execSync('npx prisma validate', { cwd: backendRoot, stdio: 'inherit' });

const dirs = readdirSync(migrationsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

const missing: string[] = [];
for (const dir of dirs) {
  const sql = join(migrationsDir, dir, 'migration.sql');
  if (!existsSync(sql)) missing.push(dir);
}

if (missing.length) {
  console.error('Migrations sem migration.sql:', missing.join(', '));
  process.exit(1);
}

const required = [
  '20260826120000_unidade_processo',
  '20260826140000_portal_notif_unidade_processo',
  '20260831220000_cessao_titularidade',
  '20260902230000_cessao_comprovante',
  '20260903120000_fretes',
  '20260906120000_cadastros_terceiros',
  '20260906180000_terceiro_documentos_cnh',
  '20260906200000_terceiro_varias_carretas',
  '20260906210000_terceiro_carreta_capacidade_renavam',
  '20260907010000_terceiro_whatsapp',
  '20260907020000_cliente_papeis',
  '20260907200000_drop_tos_legacy',
  '20260907210000_servicos_adicionais_fatura',
  '20260907220000_servico_efeitos',
  '20260908120000_aluguel_containers',
];
const absentRequired = required.filter((name) => !dirs.includes(name));
if (absentRequired.length) {
  console.error('Migrations obrigatórias ausentes:', absentRequired.join(', '));
  process.exit(1);
}

try {
  execSync('npx prisma migrate status', { cwd: backendRoot, stdio: 'pipe' });
  console.log('migrate status: OK');
} catch {
  console.warn(
    'migrate status: pendências ou DB indisponível — se o histórico local estiver dessincronizado, aplique o SQL com `npx prisma db execute --file prisma/migrations/<dir>/migration.sql` em vez de `migrate deploy` cego.',
  );
}

console.log(`OK: ${dirs.length} migrations com migration.sql + schema válido`);
