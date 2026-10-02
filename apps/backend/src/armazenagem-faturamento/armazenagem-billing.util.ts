import { Prisma } from '@prisma/client';

export const DEFAULT_FREE_TIME_DIAS = 5;
export const DEFAULT_VALOR_DIARIA = 85;
export const DEFAULT_VALOR_SERVICOS_EXTRAS = 120;

export type ProvisionCalc = {
  diasEstadia: number;
  diasCobrados: number;
  valorAcumulado: number;
  cobrancaInicioEm: Date | null;
};

/** Dias corridos entre duas datas (UTC midnight). */
export function diffCalendarDays(from: Date, to: Date): number {
  const start = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const end = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.max(0, Math.floor((end - start) / 86_400_000));
}

function ymdSaoPaulo(d: Date): { y: number; m: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const get = (t: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { y: get('year'), m: get('month'), day: get('day') };
}

/**
 * Dias corridos no pátio, calendário de Brasília, inclusive o dia da chegada.
 * Chegou e saiu no mesmo dia = 1. Free time 7 = datas 1..7 isentas (faixa começa no dia 8).
 */
export function diffDiasCalendario(inicio: Date, fim: Date): number {
  if (fim < inicio) return 0;
  const a = ymdSaoPaulo(inicio);
  const b = ymdSaoPaulo(fim);
  const start = Date.UTC(a.y, a.m - 1, a.day);
  const end = Date.UTC(b.y, b.m - 1, b.day);
  return Math.floor((end - start) / 86_400_000) + 1;
}

export function addCalendarDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function computeProvision(
  gateInAt: Date,
  asOf: Date,
  freeTimeDias: number,
  valorDiaria: Prisma.Decimal | number,
  valorServicosExtras: Prisma.Decimal | number,
): ProvisionCalc {
  const diasEstadia = diffCalendarDays(gateInAt, asOf);
  const diasCobrados = Math.max(0, diasEstadia - freeTimeDias);
  const diaria = Number(valorDiaria);
  const extras = diasCobrados > 0 ? Number(valorServicosExtras) : 0;
  const valorAcumulado = roundMoney(diasCobrados * diaria + extras);
  const cobrancaInicioEm =
    diasCobrados > 0 ? addCalendarDays(gateInAt, freeTimeDias) : null;

  return { diasEstadia, diasCobrados, valorAcumulado, cobrancaInicioEm };
}

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function toDecimal(n: number): Prisma.Decimal {
  return new Prisma.Decimal(n.toFixed(2));
}
