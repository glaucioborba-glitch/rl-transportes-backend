import { TenantParametros } from '../../tenant/tenant-config.types';

export const CLIENTE_FINANCE_SELECT = {
  diasToleranciaBloqueio: true,
  percentualMultaAtraso: true,
  percentualJurosAoMes: true,
} as const;

export type ClienteFinanceOverrides = {
  diasToleranciaBloqueio?: number | null;
  percentualMultaAtraso?: { toNumber?: () => number } | number | null;
  percentualJurosAoMes?: { toNumber?: () => number } | number | null;
};

export type FinanceProfileResolved = {
  diasToleranciaBloqueio: number;
  percentualMultaAtraso: number;
  percentualJurosAoMes: number;
};

function toNum(v: ClienteFinanceOverrides['percentualMultaAtraso']): number | undefined {
  if (v == null) return undefined;
  if (typeof v === 'number') return v;
  if (typeof v.toNumber === 'function') return v.toNumber();
  return Number(v);
}

/** Resolve parâmetros financeiros do cliente com fallback no TenantConfig. */
export function resolveFinanceProfile(
  cliente: ClienteFinanceOverrides,
  parametros: TenantParametros,
): FinanceProfileResolved {
  const op = parametros.operacao ?? {};
  return {
    diasToleranciaBloqueio:
      cliente.diasToleranciaBloqueio ??
      op.diasInadimplenciaBloqueio ??
      op.diasToleranciaBloqueioPadrao ??
      30,
    percentualMultaAtraso:
      toNum(cliente.percentualMultaAtraso) ?? op.percentualMultaAtrasoPadrao ?? 2,
    percentualJurosAoMes:
      toNum(cliente.percentualJurosAoMes) ?? op.percentualJurosAoMesPadrao ?? 1,
  };
}

/** Dias corridos de atraso (0 se ainda no prazo). */
export function diffDiasAtraso(dataVencimento: Date, asOf = new Date()): number {
  const venc = startOfDayUtc(dataVencimento);
  const hoje = startOfDayUtc(asOf);
  const ms = hoje.getTime() - venc.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export function inadimplenciaExcedeTolerancia(
  dataVencimento: Date,
  diasToleranciaBloqueio: number,
  asOf = new Date(),
): boolean {
  return diffDiasAtraso(dataVencimento, asOf) > diasToleranciaBloqueio;
}

function startOfDayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
