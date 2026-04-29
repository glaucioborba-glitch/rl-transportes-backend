import type { WorkflowCondicao } from './automacao.types';

/** Extrai valor aninhado "a.b.c" do payload. */
export function valorDoCampo(payload: Record<string, unknown>, campo: string): unknown {
  const partes = campo.split('.');
  let cur: unknown = payload;
  for (const p of partes) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

export function avaliarCondicoes(
  payload: Record<string, unknown>,
  condicoes: WorkflowCondicao[],
): boolean {
  if (!condicoes.length) return true;
  return condicoes.every((c) => {
    const v = valorDoCampo(payload, c.campo);
    switch (c.op) {
      case 'eq':
        return v === c.valor || String(v) === String(c.valor);
      case 'ne':
        return v !== c.valor && String(v) !== String(c.valor);
      case 'gt':
        return Number(v) > Number(c.valor);
      case 'gte':
        return Number(v) >= Number(c.valor);
      case 'lt':
        return Number(v) < Number(c.valor);
      case 'lte':
        return Number(v) <= Number(c.valor);
      case 'contains':
        return String(v ?? '').includes(String(c.valor));
      default:
        return false;
    }
  });
}

/**
 * Avalia expressão linear simples: "campo>num", "campo>=num", igualdade campo=valor
 */
export function avaliarExpressaoRegra(expr: string, contexto: Record<string, unknown>): boolean {
  const s = expr.trim();
  const mGt = /^([\w.]+)\s*>\s*([\d.]+)$/.exec(s);
  if (mGt) {
    const v = valorDoCampo(contexto, mGt[1]);
    return Number(v) > Number(mGt[2]);
  }
  const mGte = /^([\w.]+)\s*>=\s*([\d.]+)$/.exec(s);
  if (mGte) {
    const v = valorDoCampo(contexto, mGte[1]);
    return Number(v) >= Number(mGte[2]);
  }
  const mEq = /^([\w.]+)\s*=\s*(.+)$/.exec(s);
  if (mEq) {
    const v = valorDoCampo(contexto, mEq[1]);
    const want = mEq[2].replace(/^['"]|['"]$/g, '');
    return String(v) === want;
  }
  return false;
}

const TRANSICOES: Record<string, string[]> = {
  criado: ['portaria'],
  portaria: ['gate-in'],
  'gate-in': ['patio'],
  patio: ['gate-out'],
  'gate-out': ['finalizado'],
  finalizado: [],
};

export function transicaoEstadoPermitida(de: string, para: string): boolean {
  const ok = TRANSICOES[de];
  return !!ok && ok.includes(para);
}

export function estadosAdjacentes(de: string): string[] {
  return TRANSICOES[de] ?? [];
}
