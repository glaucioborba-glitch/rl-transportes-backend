import { MOEDAS_CORRENTES, type MoedaCorrenteCodigo } from '../../tenant/empresa-operadora.types';

const SIMBOLOS: Record<MoedaCorrenteCodigo, string> = {
  BRL: 'R$',
  USD: 'US$',
  EUR: '€',
  PYG: '₲',
  ARS: 'AR$',
  CLP: 'CLP$',
  UYU: '$U',
  PEN: 'S/',
  COP: 'COP$',
};

/** Número contábil pt-BR: 1.550,32 */
export function formatContabil(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  });
}

/** Moeda do sistema + número contábil: R$ 1.550,32 */
export function formatMoeda(n: number, codigo: string = 'BRL'): string {
  if (!Number.isFinite(n)) return '—';
  const code = (MOEDAS_CORRENTES as readonly string[]).includes(codigo)
    ? (codigo as MoedaCorrenteCodigo)
    : 'BRL';
  return `${SIMBOLOS[code]} ${formatContabil(n)}`;
}
