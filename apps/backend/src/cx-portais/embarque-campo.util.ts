export const CAMPOS_EMBARQUE = ['booking', 'processo', 'navio'] as const;
export type CampoEmbarque = (typeof CAMPOS_EMBARQUE)[number];

export const ALCANCES_EMBARQUE = ['unidade', 'processo', 'booking', 'navio'] as const;
export type AlcanceEmbarque = (typeof ALCANCES_EMBARQUE)[number];

export const LABEL_CAMPO_EMBARQUE: Record<CampoEmbarque, string> = {
  booking: 'Booking',
  processo: 'Processo',
  navio: 'Navio',
};

export function isCampoEmbarque(value: unknown): value is CampoEmbarque {
  return CAMPOS_EMBARQUE.includes(String(value ?? '') as CampoEmbarque);
}

export function isAlcanceEmbarque(value: unknown): value is AlcanceEmbarque {
  return ALCANCES_EMBARQUE.includes(String(value ?? '') as AlcanceEmbarque);
}

/** Trim, teto 120; navio em maiúsculas. Vazio limpa o campo. */
export function normalizeValorEmbarque(campo: CampoEmbarque, raw: unknown): string {
  const valor = String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  if (campo === 'navio') return valor.toUpperCase();
  return valor;
}

export function chaveAgrupamentoEmbarque(
  alcance: Exclude<AlcanceEmbarque, 'unidade'>,
  valor: unknown,
): string {
  const v = String(valor ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (alcance === 'navio') return v.toUpperCase();
  return v;
}

export function valoresBatemAlcance(
  alcance: Exclude<AlcanceEmbarque, 'unidade'>,
  chaveGrupo: string,
  valores: { booking?: string | null; processo?: string | null; navio?: string | null },
): boolean {
  if (!chaveGrupo) return false;
  return chaveAgrupamentoEmbarque(alcance, valores[alcance]) === chaveGrupo;
}

export function dataCampoEmbarque(
  campo: CampoEmbarque,
  valor: string,
): { booking: string } | { processo: string } | { navio: string } {
  if (campo === 'booking') return { booking: valor };
  if (campo === 'processo') return { processo: valor };
  return { navio: valor };
}
