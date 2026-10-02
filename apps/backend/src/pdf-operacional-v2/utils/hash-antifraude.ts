import { createHash } from 'crypto';

/** JSON canônico (chaves ordenadas) para hash estável entre Node e verificação. */
export function stableStringify(value: unknown): string {
  if (value === null) return 'null';
  const t = typeof value;
  if (t === 'string' || t === 'number' || t === 'boolean') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  }
  if (t === 'object') {
    const o = value as Record<string, unknown>;
    const keys = Object.keys(o).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function gerarHashAntiFraude(payload: Record<string, unknown>): string {
  return createHash('sha256').update(stableStringify(payload)).digest('hex');
}

export function diffAntifraudPayloads(
  antes: Record<string, unknown>,
  depois: Record<string, unknown>,
): Array<{ campo: string; antes: unknown; depois: unknown }> {
  const keys = new Set([...Object.keys(antes), ...Object.keys(depois)]);
  const out: Array<{ campo: string; antes: unknown; depois: unknown }> = [];
  for (const k of keys) {
    if (k === 'fingerprint') continue;
    const a = stableStringify(antes[k]);
    const b = stableStringify(depois[k]);
    if (a !== b) {
      out.push({ campo: k, antes: antes[k], depois: depois[k] });
    }
  }
  return out;
}
