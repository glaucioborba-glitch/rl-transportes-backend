const DAY_MS = 86_400_000;

export const REGIMES_SABADO = ['SEM_SABADO', 'TODOS_SABADOS', 'ESPANHOL'] as const;
export type RegimeSabado = (typeof REGIMES_SABADO)[number];

export function parseYmdUtc(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function ymdUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

export function nearestSaturdayOnOrAfter(ymd: string): string {
  const dt = parseYmdUtc(ymd);
  const day = dt.getUTCDay();
  const add = day === 6 ? 0 : (6 - day + 7) % 7;
  dt.setUTCDate(dt.getUTCDate() + add);
  return ymdUtc(dt);
}

export function addWeeksYmd(ymd: string, weeks: number): string {
  const dt = parseYmdUtc(ymd);
  dt.setUTCDate(dt.getUTCDate() + weeks * 7);
  return ymdUtc(dt);
}

/** `referencia` é um sábado em que a turma trabalha. Semanas pares = trabalha. */
export function isEspanholSabadoTrabalho(referenciaYmd: string, sabadoYmd: string): boolean {
  const ref = parseYmdUtc(nearestSaturdayOnOrAfter(referenciaYmd));
  const sat = parseYmdUtc(nearestSaturdayOnOrAfter(sabadoYmd));
  const weeks = Math.round((sat.getTime() - ref.getTime()) / (7 * DAY_MS));
  return weeks % 2 === 0;
}

export function proximoParEspanhol(
  referenciaYmd: string,
  hojeYmd: string,
): { trabalha: string; folga: string } {
  const sat = nearestSaturdayOnOrAfter(hojeYmd);
  const satETrabalho = isEspanholSabadoTrabalho(referenciaYmd, sat);
  return satETrabalho
    ? { trabalha: sat, folga: addWeeksYmd(sat, 1) }
    : { trabalha: addWeeksYmd(sat, 1), folga: sat };
}
