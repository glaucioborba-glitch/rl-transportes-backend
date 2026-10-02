import { normalizePlate } from '../common/utils/data-sanitize';
import { isValidPlacaMercosulExtended } from '../common/utils/mercosul';

export type OptionalPlacaResult =
  | { ok: true; placa: string | null }
  | { ok: false };

/** Vazio é válido (campo opcional). Preenchido precisa ser Mercosul, antiga ou 4 letras. */
export function parseOptionalPlacaPreferencial(raw: string | null | undefined): OptionalPlacaResult {
  const placa = normalizePlate(raw ?? '');
  if (!placa) return { ok: true, placa: null };
  if (!isValidPlacaMercosulExtended(placa)) return { ok: false };
  return { ok: true, placa };
}
