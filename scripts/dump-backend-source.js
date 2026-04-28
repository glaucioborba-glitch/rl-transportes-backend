/**
 * Gera um único .txt com todo o fonte de apps/backend (ordem alfabética).
 * Uso: node scripts/dump-backend-source.js
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const BACKEND = path.join(REPO, 'apps', 'backend');
const OUT = path.join(REPO, 'RL-Transportes-Backend-CODIGO-COMPLETO.txt');

const EXCLUDE_DIRS = new Set(['node_modules', 'dist', '.git', 'coverage', 'logs']);

function isExcludedEnvFile(name) {
  if (name === '.env' || name.startsWith('.env.')) return true;
  return false;
}

function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (EXCLUDE_DIRS.has(ent.name)) continue;
      out.push(...walk(full));
    } else {
      if (isExcludedEnvFile(ent.name)) continue;
      out.push(full);
    }
  }
  return out;
}

function rel(f) {
  return path.relative(REPO, f).split(path.sep).join('/');
}

function main() {
  if (!fs.existsSync(BACKEND)) {
    console.error('Pasta apps/backend não encontrada:', BACKEND);
    process.exit(1);
  }
  const absFiles = walk(BACKEND);
  const withRel = absFiles
    .map((abs) => ({ abs, r: rel(abs) }))
    .sort((a, b) => a.r.localeCompare(b.r, 'en'));

  const parts = [];
  for (let i = 0; i < withRel.length; i++) {
    const { abs, r } = withRel[i];
    let content;
    try {
      content = fs.readFileSync(abs, { encoding: 'utf8' });
    } catch (e) {
      if (i > 0) {
        parts.push('================================================================================');
      }
      parts.push(`FILE: ${r}`);
      parts.push(`[ERRO AO LER: ${e.message}]`);
      continue;
    }
    if (i > 0) {
      parts.push('================================================================================');
    }
    parts.push(`FILE: ${r}`);
    parts.push(content);
  }

  const text = parts.join('\n') + (parts.length ? '\n' : '');
  fs.writeFileSync(OUT, text, { encoding: 'utf8' });
  console.log('Gerado:', OUT);
  console.log('Arquivos:', withRel.length);
  console.log('Tamanho (bytes):', Buffer.byteLength(text, 'utf8'));
}

main();
