import { stripContainerIsoCanonical } from '../common/utils/data-sanitize';

/** Busca de estoque do cliente: ISO, ID, protocolo, booking, processo, navio. */
export function estoqueClienteMatchesQuery(
  row: {
    unidadeIso: string;
    numero: number;
    protocolo: string;
    booking?: string | null;
    processo?: string | null;
    navio?: string | null;
  },
  qRaw: string,
): boolean {
  const q = qRaw.trim();
  if (!q) return true;
  const compact = q.replace(/[\s-]/g, '').toUpperCase();
  const iso = stripContainerIsoCanonical(row.unidadeIso);
  if (iso.includes(compact)) return true;
  const digits = compact.replace(/\D/g, '');
  if (digits.length > 0 && String(row.numero).includes(digits)) return true;
  const hay = [row.protocolo, row.booking, row.processo, row.navio]
    .filter(Boolean)
    .join(' ')
    .toUpperCase();
  return hay.includes(q.toUpperCase());
}
