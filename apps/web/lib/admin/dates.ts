export function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function lastNDays(n: number) {
  const fim = new Date();
  const ini = new Date(fim);
  ini.setDate(ini.getDate() - n);
  return { ini: isoDate(ini), fim: isoDate(fim) };
}

export function currentPeriodoYM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthsBackYm(n: number) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
