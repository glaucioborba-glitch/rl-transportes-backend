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

try {
  execSync('npx prisma migrate status', { cwd: backendRoot, stdio: 'pipe' });
  console.log('migrate status: OK (sem pendências ou DB indisponível ignorado em CI local)');
} catch {
  console.warn('migrate status: pendências detectadas — execute npm run db:migrate antes do deploy');
}

console.log(`OK: ${dirs.length} migrations com migration.sql + schema válido`);
