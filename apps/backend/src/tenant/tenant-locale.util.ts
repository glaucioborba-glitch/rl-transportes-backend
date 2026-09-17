export const MOEDAS_CORRENTES = [
  'BRL',
  'USD',
  'EUR',
  'PYG',
  'ARS',
  'CLP',
  'UYU',
  'PEN',
  'COP',
] as const;

export type MoedaCorrenteCodigo = (typeof MOEDAS_CORRENTES)[number];

export const IDIOMAS_PADRAO = ['pt-BR', 'es-ES', 'en-US'] as const;

export type IdiomaPadraoCodigo = (typeof IDIOMAS_PADRAO)[number];

export const MOEDA_PADRAO: MoedaCorrenteCodigo = 'BRL';
export const IDIOMA_PADRAO: IdiomaPadraoCodigo = 'pt-BR';

export function parseMoedaCorrente(v: unknown): MoedaCorrenteCodigo {
  const s = String(v ?? '').trim().toUpperCase();
  return (MOEDAS_CORRENTES as readonly string[]).includes(s) ? (s as MoedaCorrenteCodigo) : MOEDA_PADRAO;
}

export function parseIdiomaPadrao(v: unknown): IdiomaPadraoCodigo {
  const s = String(v ?? '').trim();
  return (IDIOMAS_PADRAO as readonly string[]).includes(s) ? (s as IdiomaPadraoCodigo) : IDIOMA_PADRAO;
}
