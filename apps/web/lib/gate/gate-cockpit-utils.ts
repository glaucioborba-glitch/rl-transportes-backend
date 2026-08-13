import type { GateTurno } from "./gate-cockpit-types";

/** T1 06–14h · T2 14–22h · T3 22–06h (horário local do terminal). */
export function turnoFromIso(iso: string): GateTurno {
  const h = new Date(iso).getHours();
  if (h >= 6 && h < 14) return "T1";
  if (h >= 14 && h < 22) return "T2";
  return "T3";
}

export function matchesTurno(iso: string, filtro: GateTurno): boolean {
  if (filtro === "TODOS") return true;
  return turnoFromIso(iso) === filtro;
}

export function formatDuracao(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

export function formatChegada(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
