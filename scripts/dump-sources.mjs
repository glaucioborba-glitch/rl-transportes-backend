/**
 * Gera consolidacao de fontes para auditoria (ex.: PROJETO-CODIGO-COMPLETO.txt).
 * Uso: node scripts/dump-sources.mjs > PROJETO-CODIGO-COMPLETO.txt
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const SKIP_DIRS = new Set([
  ".git",
  ".next",
  "coverage",
  "dist",
  "node_modules",
  "mcps",
  "terminals",
]);

const SKIP_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".zip", ".woff", ".woff2"]);
const MAX_FILE = 800_000;

function* walk(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      yield* walk(full);
    } else {
      yield full;
    }
  }
}

function includeFile(rel) {
  const lower = rel.toLowerCase();
  const ext = path.extname(lower);
  if (SKIP_EXT.has(ext)) return false;
  if (lower.includes("package-lock")) return false;
  if (rel.startsWith(`apps${path.sep}web${path.sep}.next`)) return false;
  return true;
}

const lines = [
  "RL Transportes — consolidacao de codigo-fonte",
  `Gerado em: ${new Date().toISOString()}`,
  "Exclui: node_modules, dist, coverage, .git, .next, mcps, terminais, imagens, package-lock.",
  "",
];

const files = [];
for (const f of walk(root)) {
  const rel = path.relative(root, f);
  if (!includeFile(rel)) continue;
  const stat = fs.statSync(f);
  if (stat.size > MAX_FILE) continue;
  const ext = path.extname(f);
  if (
    ![
      ".ts",
      ".tsx",
      ".js",
      ".mjs",
      ".cjs",
      ".json",
      ".css",
      ".prisma",
      ".sql",
      ".md",
      ".yml",
      ".yaml",
      ".toml",
    ].includes(ext) &&
    !["Dockerfile", ".gitignore", ".env.example"].some((s) => f.endsWith(s) || rel.endsWith(s))
  ) {
    continue;
  }
  files.push(rel);
}

files.sort();
for (const rel of files) {
  const full = path.join(root, rel);
  let content;
  try {
    content = fs.readFileSync(full, "utf8");
  } catch {
    continue;
  }
  lines.push("=".repeat(80), `FILE: ${rel.replace(/\\/g, "/")}`, "=".repeat(80), content);
  if (!content.endsWith("\n")) lines.push("");
}

process.stdout.write(lines.join("\n"));
