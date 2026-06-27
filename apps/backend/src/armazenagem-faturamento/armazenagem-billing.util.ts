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
