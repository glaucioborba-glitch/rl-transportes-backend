import { inflateRawSync, inflateSync } from 'node:zlib';

export type TipoDocumentoTerceiroExtract = 'CNH' | 'CRLV_CAVALO' | 'CRLV_CARRETA' | 'CRLV_CARRETA_02';

export type TerceiroExtractSugestao = {
  nome?: string;
  cpf?: string;
  cnhCategoria?: string;
  cnhValidade?: string;
  placa?: string;
  donoNome?: string;
  renavam?: string;
  crlvValidade?: string;
};

const CPF_RE = /\b(\d{3}\.?\d{3}\.?\d{3}-?\d{2})\b/;
const PLACA_RE = /\b([A-Z]{3}\d[A-Z0-9]\d{2})\b/;
const DATA_RE = /\b(\d{2}\/\d{2}\/\d{4})\b/g;
const CAT_RE = /\b(?:CAT(?:EGORIA)?[:\s]*)([A-E]{1,2}(?:\/[A-E]{1,2})?)\b/;

export function extractPdfPlainText(buffer: Buffer): string {
  const src = buffer.toString('latin1');
  const parts: string[] = [pullPdfLiteralStrings(src)];
  const streamRe = /stream\r?\n([\s\S]*?)endstream/g;
  let m: RegExpExecArray | null;
  while ((m = streamRe.exec(src))) {
    const raw = Buffer.from(m[1].replace(/^\r?\n/, ''), 'latin1');
    let decoded = raw;
    try {
      decoded = inflateSync(raw);
    } catch {
      try {
        decoded = inflateRawSync(raw);
      } catch {
        decoded = raw;
      }
    }
    parts.push(pullPdfLiteralStrings(decoded.toString('latin1')));
  }
  return normalizeExtractText(parts.join(' '));
}

function pullPdfLiteralStrings(s: string): string {
  const out: string[] = [];
  const re = /\((?:\\.|[^\\)])*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const inner = m[0]
      .slice(1, -1)
      .replace(/\\n/g, ' ')
      .replace(/\\r/g, ' ')
      .replace(/\\t/g, ' ')
      .replace(/\\(.)/g, '$1');
    if (inner.trim()) out.push(inner);
  }
  return out.join(' ');
}

export function normalizeExtractText(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

export function parseDocumentoTerceiro(
  tipo: TipoDocumentoTerceiroExtract,
  texto: string,
): { sugestoes: TerceiroExtractSugestao; campos: number; confianca: number } {
  const t = normalizeExtractText(texto).toUpperCase();
  const sugestoes: TerceiroExtractSugestao = {};

  if (tipo === 'CNH') {
    const cpf = firstCpf(t);
    if (cpf) sugestoes.cpf = cpf;
    const cat = t.match(CAT_RE)?.[1]?.replace('/', '');
    if (cat && /^[A-E]{1,2}$/.test(cat)) sugestoes.cnhCategoria = cat;
    const validade = pickValidade(t);
    if (validade) sugestoes.cnhValidade = validade;
    const nome = pickNome(texto, /nome[:\s]+([A-ZÀ-Ú][A-ZÀ-Ú\s]{4,80})/i);
    if (nome) sugestoes.nome = nome;
  } else {
    const placa = t.match(PLACA_RE)?.[1];
    if (placa) sugestoes.placa = placa;
    const dono = pickNome(texto, /(?:propriet[aá]rio|nome)[:\s]+([A-ZÀ-Ú][A-ZÀ-Ú\s]{4,80})/i);
    if (dono) sugestoes.donoNome = dono;
    const cpf = firstCpf(t);
    if (cpf) sugestoes.cpf = cpf;
    const renavam = t.match(/(?:RENAVAM|RENAVAN)[:\s]*(\d{9,11})/)?.[1] ?? t.match(/\b(\d{11})\b/)?.[1];
    if (renavam) sugestoes.renavam = renavam;
    const crlvValidade = pickValidade(t);
    if (crlvValidade) sugestoes.crlvValidade = crlvValidade;
  }

  const campos = Object.values(sugestoes).filter(Boolean).length;
  const esperado = tipo === 'CNH' ? 3 : 1;
  const confianca = campos === 0 ? 0 : Math.min(1, 0.45 + (campos / Math.max(esperado, 1)) * 0.45);
  return { sugestoes, campos, confianca };
}

function firstCpf(t: string): string | undefined {
  const m = t.match(CPF_RE);
  if (!m) return undefined;
  const d = m[1].replace(/\D/g, '');
  return d.length === 11 ? d : undefined;
}

function pickValidade(t: string): string | undefined {
  const dates = [...t.matchAll(DATA_RE)].map((m) => m[1]);
  const iso = dates
    .map(brToIso)
    .filter((d): d is string => Boolean(d))
    .sort();
  const future = iso.find((d) => d >= new Date().toISOString().slice(0, 10));
  return future ?? iso.at(-1);
}

function brToIso(br: string): string | undefined {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br);
  if (!m) return undefined;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  const dt = new Date(`${iso}T12:00:00.000Z`);
  return Number.isNaN(dt.getTime()) ? undefined : iso;
}

function pickNome(original: string, re: RegExp): string | undefined {
  const m = original.match(re);
  const raw = m?.[1]?.replace(/\s+/g, ' ').trim();
  if (!raw || raw.length < 5) return undefined;
  return raw
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}
