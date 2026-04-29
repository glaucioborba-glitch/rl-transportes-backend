import { hashSeed } from "@/lib/rh/hash";

export type FatigueLevel = "baixa" | "moderada" | "alta";

export type FatigueInputs = {
  lastShiftHours?: number;
  hoursSinceRest?: number;
  weeklyAccumulated?: number;
  interventionsPerHour?: number;
};

export function fatigueScore(inputs: FatigueInputs): number {
  const h = inputs.lastShiftHours ?? 0;
  const r = inputs.hoursSinceRest ?? 12;
  const w = inputs.weeklyAccumulated ?? 40;
  const i = inputs.interventionsPerHour ?? 2;
  let s = 0;
  s += Math.min(40, h * 4);
  s += Math.max(0, 22 - r) * 1.2;
  s += Math.max(0, w - 44) * 0.8;
  s += Math.max(0, i - 3) * 6;
  return Math.min(100, Math.round(s));
}

export function fatigueLevel(score: number): FatigueLevel {
  if (score < 40) return "baixa";
  if (score < 70) return "moderada";
  return "alta";
}

/** RJT 0–100 proxy maior = mais risco */
export function rjtProxy(id: string, ops24h: number, weeklyHours: number): number {
  const base = hashSeed(id) % 15;
  const op = Math.min(40, ops24h * 2.5);
  const wk = Math.max(0, weeklyHours - 40) * 1.5;
  return Math.min(100, Math.round(base + op + wk));
}

export function mockWeeklyHours(id: string): number {
  return 36 + (hashSeed(id) % 24);
}
