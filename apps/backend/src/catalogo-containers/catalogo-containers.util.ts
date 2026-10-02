import { stripContainerIsoCanonical } from '../common/utils/data-sanitize';
import { capacidadeDcHcFromTipoIso } from '../modules/ocr/utils/ocr-parsers';

export type CatalogoContainerPesosKg = {
  mgwKg?: number | null;
  taraKg?: number | null;
  payloadKg?: number | null;
};

export type CatalogoContainerMergeInput = CatalogoContainerPesosKg & {
  unidadeIso?: string;
  tipoIso?: string | null;
  tipoCodigo?: string | null;
  tamanhoPes?: string | null;
  perfil?: string | null;
  owner?: string | null;
};

/** Peso da placa CSC — sempre inteiro em quilogramas. */
export function kgFromUnknown(value: unknown): number | null {
  if (value == null || value === '') return null;
  const compact = String(value)
    .trim()
    .replace(/[^\d.,]/g, '')
    .replace(/\.(?=\d{3}\b)/g, '')
    .replace(',', '.');
  const n = Number(compact);
  if (!Number.isFinite(n) || n < 100 || n > 200000) return null;
  return Math.round(n);
}

export function normalizeCatalogoIso(value: unknown): string {
  return stripContainerIsoCanonical(String(value ?? ''));
}

/** Cubagem DC/HC — opcional. Não mistura com tipo (REEFER, FLATRACK…). */
export function normalizeCapacidadeDcHc(value: unknown): 'DC' | 'HC' | null {
  const raw = String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (!raw) return null;
  if (raw === 'HC' || raw === 'HIGHCUBE') return 'HC';
  if (raw === 'DC' || raw === 'GP' || raw === 'STANDARD') return 'DC';
  if (/^(20|40|45)HC$/.test(raw)) return 'HC';
  if (/^(20|40|45)DC$/.test(raw)) return 'DC';
  return null;
}

export function resolveCatalogoCapacidade(row: {
  perfil?: string | null;
  tipoIso?: string | null;
}): 'DC' | 'HC' | null {
  return normalizeCapacidadeDcHc(row.perfil) ?? capacidadeDcHcFromTipoIso(row.tipoIso);
}

function keepText(incoming?: string | null, existing?: string | null): string | null {
  const next = incoming?.trim() || '';
  if (next) return next;
  return existing?.trim() || null;
}

function keepKg(incoming?: number | null, existing?: number | null): number | null {
  return incoming != null ? incoming : (existing ?? null);
}

/** Gate novo prevalece em tipo/tamanho; pesos só entram se vierem em kg. */
export function mergeCatalogoContainer(
  existing: CatalogoContainerMergeInput | null | undefined,
  incoming: CatalogoContainerMergeInput,
): CatalogoContainerMergeInput {
  return {
    unidadeIso: incoming.unidadeIso || existing?.unidadeIso,
    tipoIso: keepText(incoming.tipoIso, existing?.tipoIso),
    tipoCodigo: keepText(incoming.tipoCodigo, existing?.tipoCodigo),
    tamanhoPes: keepText(incoming.tamanhoPes, existing?.tamanhoPes),
    perfil: keepText(incoming.perfil, existing?.perfil),
    owner: keepText(incoming.owner, existing?.owner),
    mgwKg: keepKg(incoming.mgwKg, existing?.mgwKg),
    taraKg: keepKg(incoming.taraKg, existing?.taraKg),
    payloadKg: keepKg(incoming.payloadKg, existing?.payloadKg),
  };
}
