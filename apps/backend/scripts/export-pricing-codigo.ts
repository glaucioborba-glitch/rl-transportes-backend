/**
 * Exporta código do workstream Pricing Unificado (A.1–A.5) para .txt
 * Uso: npx ts-node scripts/export-pricing-codigo.ts
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(__dirname, '../../..');
const OUT = path.join(ROOT, 'CODIGO-PRICING-UNIFICADO.txt');

const PREFIXES = [
  'apps/backend/src/pricing-sync/',
  'apps/backend/src/billing-engine/faixa-diaria',
  'apps/backend/src/billing-engine/billing-rule-engine',
  'apps/backend/src/cadastros/cadastros-capacidades',
  'apps/backend/src/cadastros/cadastros-tabelas-precos',
  'apps/backend/src/cadastros/dto/cadastros-tabela-preco',
  'apps/backend/src/cadastros/dto/cadastros-capacidade',
  'apps/backend/scripts/pricing-sync-seed.ts',
  'apps/backend/scripts/migrate-tabela-tarifaria-to-regras.ts',
  'apps/backend/prisma/migrations/20260729120000_pricing_unificado/',
  'apps/web/app/cadastros/financeiro/tabelas-precos/',
  'apps/web/lib/api/cadastros-tabelas-precos-client.ts',
  'apps/web/lib/api/cadastros-capacidades-container-client.ts',
  'packages/contracts/src/container-mdm.ts',
  'docs/adr/004-pricing-unificado.md',
  'docs/programa-melhorias/ROADMAP.md',
];

const EXT = new Set(['.ts', '.tsx', '.sql', '.md', '.prisma']);

function collectFiles(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      collectFiles(full, acc);
    } else if (EXT.has(path.extname(entry.name))) {
      acc.push(full);
    }
  }
  return acc;
}

function main() {
  const files = new Set<string>();

  for (const prefix of PREFIXES) {
    const abs = path.join(ROOT, prefix);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
      files.add(abs);
    } else {
      collectFiles(abs).forEach((f) => files.add(f));
    }
  }

  // schema snippets — read full schema is huge; include migration only
  const sorted = [...files].sort();
  const lines: string[] = [
    '='.repeat(80),
    'RL TRANSPORTES — PRICING UNIFICADO (Workstream A)',
    `Gerado em: ${new Date().toISOString()}`,
    `Raiz: ${ROOT}`,
    `Arquivos: ${sorted.length}`,
    '='.repeat(80),
    '',
  ];

  sorted.forEach((file, i) => {
    const rel = path.relative(ROOT, file);
    lines.push('='.repeat(80));
    lines.push(`ARQUIVO [${i + 1}/${sorted.length}]: ${rel}`);
    lines.push('='.repeat(80));
    lines.push('');
    lines.push(fs.readFileSync(file, 'utf8'));
    lines.push('');
  });

  fs.writeFileSync(OUT, lines.join('\n'), 'utf8');
  console.log(`Exportado: ${OUT} (${sorted.length} arquivos)`);
}

main();
