export const PATIO_ZONAS = ['A', 'B', 'C'] as const;
export const PATIO_POSICOES_POR_ZONA = 12;
export const PATIO_GRADE_COLUNAS = 4;
export const PATIO_GRADE_LINHAS = 3;

/**
 * Ordem de desenho da grade CSS (esquerda → direita, cima → baixo).
 * Posição 1 = canto inferior esquerdo; 2 = acima dela; sobe a coluna e segue para a direita.
 *  3  6  9 12
 *  2  5  8 11
 *  1  4  7 10
 */
export function posicoesOrdemVisual(): number[] {
  const out: number[] = [];
  for (let rowFromTop = 0; rowFromTop < PATIO_GRADE_LINHAS; rowFromTop++) {
    for (let col = 0; col < PATIO_GRADE_COLUNAS; col++) {
      const rowFromBottom = PATIO_GRADE_LINHAS - 1 - rowFromTop;
      out.push(col * PATIO_GRADE_LINHAS + rowFromBottom + 1);
    }
  }
  return out;
}

export function rotuloPosicaoPatio(posicao: number): string {
  return String(posicao).padStart(2, '0');
}

export function normalizeZonaPatio(codigo: string): string {
  return codigo.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
}

export function codigoPatioZonaPosicao(zona: string, posicao: number): string {
  return `${normalizeZonaPatio(zona)}-${posicao}`;
}

export function parsePatioZonaPosicao(
  codigo: string | null | undefined,
): { zona: string; posicao: number } | null {
  if (!codigo?.trim()) return null;
  const raw = codigo.trim().toUpperCase();
  const comHifen = raw.match(/^([A-Z][A-Z0-9]*)-(\d{1,2})$/);
  if (comHifen) {
    const posicao = Number(comHifen[2]);
    if (Number.isInteger(posicao) && posicao >= 1 && posicao <= PATIO_POSICOES_POR_ZONA) {
      return { zona: comHifen[1], posicao };
    }
    return null;
  }
  const legado = raw.match(/^([A-Z]+)(\d{1,2})$/);
  if (!legado) return null;
  const posicao = Number(legado[2]);
  if (!Number.isInteger(posicao) || posicao < 1 || posicao > PATIO_POSICOES_POR_ZONA) return null;
  return { zona: legado[1], posicao };
}

export const PATIO_FILA_URGENCIAS = ['PRIORITARIO', 'PREFERENCIAL', 'NORMAL'] as const;
export type PatioFilaUrgenciaCodigo = (typeof PATIO_FILA_URGENCIAS)[number];

export const PATIO_FILA_URGENCIA_ORDEM: Record<PatioFilaUrgenciaCodigo, number> = {
  PRIORITARIO: 0,
  PREFERENCIAL: 1,
  NORMAL: 2,
};

/** Prioritário → Preferencial → Normal; dentro do grupo, o mais novo entra por último. */
export function comparePatioFila<T extends { urgencia: string; criadoEm: Date | string }>(
  a: T,
  b: T,
): number {
  const ua = PATIO_FILA_URGENCIA_ORDEM[a.urgencia as PatioFilaUrgenciaCodigo] ?? 9;
  const ub = PATIO_FILA_URGENCIA_ORDEM[b.urgencia as PatioFilaUrgenciaCodigo] ?? 9;
  if (ua !== ub) return ua - ub;
  return new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime();
}

export function sortPatioFila<T extends { urgencia: string; criadoEm: Date | string }>(
  items: T[],
): T[] {
  return [...items].sort(comparePatioFila);
}
