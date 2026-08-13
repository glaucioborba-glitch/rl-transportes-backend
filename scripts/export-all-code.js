/**
 * Exporta todo o código-fonte do monorepo para CODIGO-COMPLETO-PROJETO.txt
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'CODIGO-COMPLETO-PROJETO.txt');
const MANIFEST = path.join(ROOT, 'CODIGO-COMPLETO-PROJETO-MANIFESTO.txt');

const EXCLUDE_DIRS = new Set([
  'node_modules', '.git', '.next', 'dist', 'build', 'coverage',
  '.turbo', '.cache', 'mcps', 'terminals', '.cursor',
]);

const EXCLUDE_FILES = new Set([
  'CODIGO-COMPLETO-PROJETO.txt',
  'CODIGO-COMPLETO-PROJETO-MANIFESTO.txt',
  '.env',
]);

const EXCLUDE_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.pdf', '.zip', '.gz', '.tar', '.7z',
  '.exe', '.dll', '.so', '.dylib',
  '.map', '.bin', '.wasm',
]);

const MAX_BYTES = 10 * 1024 * 1024;

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDE_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

function isTextFile(filePath) {
  const stat = fs.statSync(filePath);
  if (stat.size === 0) return true;
  if (stat.size > MAX_BYTES) return false;
  const fd = fs.openSync(filePath, 'r');
  const sample = Buffer.alloc(Math.min(stat.size, 8192));
  fs.readSync(fd, sample, 0, sample.length, 0);
  fs.closeSync(fd);
  return !sample.includes(0);
}

const all = walk(ROOT).sort();
const included = [];
const excluded = [];

for (const file of all) {
  const base = path.basename(file);
  const ext = path.extname(file).toLowerCase();
  if (EXCLUDE_FILES.has(base) || EXCLUDE_EXT.has(ext)) {
    excluded.push({ file, reason: 'excluido por regra' });
    continue;
  }
  if (!isTextFile(file)) {
    excluded.push({ file, reason: 'binario ou >10MB' });
    continue;
  }
  included.push(file);
}

const out = fs.createWriteStream(OUT, { encoding: 'utf8' });
out.write(`${'='.repeat(80)}\n`);
out.write(`RL TRANSPORTES MONOREPO - EXPORTACAO COMPLETA DO CODIGO\n`);
out.write(`Gerado em: ${new Date().toISOString()}\n`);
out.write(`Raiz: ${ROOT}\n`);
out.write(`Arquivos incluidos: ${included.length}\n`);
out.write(`Arquivos excluidos: ${excluded.length}\n`);
out.write(`Nota: .env omitido por seguranca; use .env.example.\n`);
out.write(`${'='.repeat(80)}\n\n`);

included.forEach((file, i) => {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  out.write(`\n${'='.repeat(80)}\n`);
  out.write(`ARQUIVO [${i + 1}/${included.length}]: ${rel}\n`);
  out.write(`${'='.repeat(80)}\n\n`);
  try {
    out.write(fs.readFileSync(file, 'utf8'));
    out.write('\n');
  } catch (err) {
    out.write(`[ERRO AO LER: ${err.message}]\n`);
  }
});

out.write(`\n${'='.repeat(80)}\n`);
out.write(`FIM DA EXPORTACAO - ${included.length} arquivos\n`);
out.write(`${'='.repeat(80)}\n`);
out.end();

const manifestLines = [
  'MANIFESTO DE ARQUIVOS EXCLUIDOS',
  `Gerado em: ${new Date().toISOString()}`,
  `Total: ${excluded.length}`,
  '',
  'Motivos: dependencias (node_modules), artefatos de build, binarios, .env (segredos), >10MB',
  '',
  ...excluded.map(({ file, reason }) => {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    const size = fs.statSync(file).size;
    return `${rel} (${size} bytes) - ${reason}`;
  }),
];
fs.writeFileSync(MANIFEST, manifestLines.join('\n'), 'utf8');

out.on('finish', () => {
  const mb = (fs.statSync(OUT).size / (1024 * 1024)).toFixed(2);
  console.log(`Exportado: ${OUT}`);
  console.log(`Manifesto: ${MANIFEST}`);
  console.log(`Incluidos: ${included.length}`);
  console.log(`Excluidos: ${excluded.length}`);
  console.log(`Tamanho: ${mb} MB`);
});
