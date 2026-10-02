import type { NomeFato } from './datahub.types';

/** MVs PostgreSQL — fonte persistente do DW (substituem fatos em memória). */
export const DATAHUB_MV_NAMES = [
  'mv_datahub_fato_solicitacoes',
  'mv_datahub_fato_gate',
  'mv_datahub_fato_patio',
  'mv_datahub_fato_saida',
  'mv_datahub_fato_faturamento',
  'mv_datahub_fato_boletos',
  'mv_datahub_fato_nfse',
] as const;

export type DatahubMvName = (typeof DATAHUB_MV_NAMES)[number];

export const DATAHUB_FATO_TO_MV: Record<
  Exclude<NomeFato, 'FATO_RH_Folha'>,
  DatahubMvName
> = {
  FATO_Solicitacoes: 'mv_datahub_fato_solicitacoes',
  FATO_Gate: 'mv_datahub_fato_gate',
  FATO_Patio: 'mv_datahub_fato_patio',
  FATO_Saida: 'mv_datahub_fato_saida',
  FATO_Faturamento: 'mv_datahub_fato_faturamento',
  FATO_Boletos: 'mv_datahub_fato_boletos',
  FATO_NFSe: 'mv_datahub_fato_nfse',
};

/** Cache L1 em memória — TTL 5 min para queries repetidas. */
export const DATAHUB_L1_CACHE_TTL_MS = 5 * 60 * 1000;
