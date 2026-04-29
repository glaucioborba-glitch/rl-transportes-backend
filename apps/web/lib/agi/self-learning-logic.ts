import type { OperationalSnapshot } from "@/lib/ai-console/operational-snapshot";

export type MinedPattern = {
  id: string;
  label: string;
  detail: string;
  confidence: number;
};

/** Front-only pattern mining from snapshots + aggregates. */
export function minePatterns(args: {
  snap: OperationalSnapshot;
  relTotal: number;
  finInadPct: number | null;
  serieOpsPeak: number;
  hour: number;
}): MinedPattern[] {
  const out: MinedPattern[] = [];
  if (args.snap.sat > 75) {
    out.push({
      id: "sat",
      label: "Saturação recorrente",
      detail: `Pico de ocupação ~${args.snap.sat.toFixed(0)}% — piso de alerta para heurística de gate.`,
      confidence: Math.min(0.95, 0.55 + args.snap.sat / 220),
    });
  }
  if (args.hour >= 9 && args.hour <= 17 && args.serieOpsPeak > 0) {
    out.push({
      id: "hour",
      label: "Horário crítico comercial",
      detail: "Picos de produtividade diária coincidem com janela 9–17h — reforço virtual sugerido.",
      confidence: 0.72,
    });
  }
  if (args.relTotal > 400) {
    out.push({
      id: "client-noise",
      label: "Alto volume de solicitações",
      detail: `${args.relTotal} solicitações no recorte — ruído operacional client-facing elevado.`,
      confidence: 0.68,
    });
  }
  if (args.finInadPct != null && args.finInadPct > 5) {
    out.push({
      id: "fin-stress",
      label: "Stress financeiro correlato",
      detail: `Inadimplência proxy ${args.finInadPct.toFixed(1)}% — padrão a monitorar vs. dwell.`,
      confidence: 0.61,
    });
  }
  if (args.snap.tpPortaria > 2 && args.snap.tpGate > 2) {
    const ratio = Math.abs(args.snap.tpPortaria - args.snap.tpGate) / Math.max(args.snap.tpPortaria, args.snap.tpGate);
    if (ratio < 0.2) {
      out.push({
        id: "eff-op",
        label: "Operação equilibrada P×G",
        detail: "Throughput portaria/gate alinhado — baseline de eficiência para tuning.",
        confidence: 0.58,
      });
    }
  }
  if (!out.length) {
    out.push({
      id: "baseline",
      label: "Baseline estável",
      detail: "Sem padrão forte no snapshot atual — minerador em escuta contínua.",
      confidence: 0.4,
    });
  }
  return out.slice(0, 10);
}

export type TuningWindow = "7d" | "14d" | "30d";

export type TunedRule = {
  id: string;
  name: string;
  window: TuningWindow;
  satLimitPct: number;
  riskThreshold: number;
  priorityWeight: number;
  reevalHours: number;
  note: string;
};

const W_FACTOR: Record<TuningWindow, number> = { "7d": 1.08, "14d": 1, "30d": 0.92 };

export function computeSelfTuningRules(args: {
  snap: OperationalSnapshot;
  baseHour: number;
}): TunedRule[] {
  const windows: TuningWindow[] = ["7d", "14d", "30d"];
  return windows.map((w, i) => {
    const f = W_FACTOR[w];
    const satBase = 78 + args.snap.sat * 0.12;
    const satLimitPct = Math.round(Math.min(94, Math.max(62, satBase * f)));
    const riskThreshold = Math.round(Math.min(92, 48 + args.snap.vb * 14 + (args.snap.taxaGargalo ? 12 : 0) * f));
    const priorityWeight = Math.round((100 + args.snap.filaLens.gate * 3 - i * 4) * f) / 100;
    const reevalHours = Math.max(2, Math.round(6 / f + (args.baseHour % 3)));
    return {
      id: `t-${w}`,
      name: `Auto-tuning · janela ${w}`,
      window: w,
      satLimitPct,
      riskThreshold,
      priorityWeight,
      reevalHours,
      note:
        w === "7d"
          ? "Mais agressivo: responde rápido a picos recentes."
          : w === "14d"
            ? "Equilíbrio operacional padrão."
            : "Suaviza ruído — favorece estabilidade.",
    };
  });
}

export type EvolutionPhase = "observar" | "comparar" | "aprender" | "ajustar" | "registrar";

export const EVOLUTION_ORDER: EvolutionPhase[] = ["observar", "comparar", "aprender", "ajustar", "registrar"];

export function evolutionSemanticVersion(tick: number): string {
  const minor = Math.floor(tick / 5) % 10;
  const patch = tick % 5;
  return `1.${minor}.${patch}`;
}

export type MemoryEntry = {
  id: string;
  heuristicId: string;
  outcome: "worked" | "failed";
  note: string;
  ts: number;
  efficacyScore: number;
};

const MEM_KEY = "agi-ops-heuristic-memory-v1";

export function loadHeuristicMemory(): MemoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(MEM_KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as MemoryEntry[];
    return Array.isArray(p) ? p.slice(0, 80) : [];
  } catch {
    return [];
  }
}

export function appendHeuristicMemory(entry: Omit<MemoryEntry, "id" | "ts"> & { id?: string }): MemoryEntry[] {
  if (typeof window === "undefined") return [];
  const prev = loadHeuristicMemory();
  const next: MemoryEntry = {
    id: entry.id ?? `m-${Date.now()}`,
    heuristicId: entry.heuristicId,
    outcome: entry.outcome,
    note: entry.note,
    ts: Date.now(),
    efficacyScore: entry.efficacyScore,
  };
  const merged = [next, ...prev].slice(0, 80);
  window.localStorage.setItem(MEM_KEY, JSON.stringify(merged));
  return merged;
}

export function averageEfficacyByHeuristic(entries: MemoryEntry[]): { id: string; avg: number; n: number }[] {
  const map = new Map<string, { sum: number; n: number }>();
  for (const e of entries) {
    const k = e.heuristicId;
    const g = map.get(k) ?? { sum: 0, n: 0 };
    g.sum += e.efficacyScore;
    g.n += 1;
    map.set(k, g);
  }
  return Array.from(map.entries()).map(([id, { sum, n }]) => ({ id, avg: Math.round((sum / n) * 10) / 10, n }));
}

export type EmergedPolicy = { id: string; rule: string; basis: string };

export function emergePolicies(patterns: MinedPattern[], snap: OperationalSnapshot): EmergedPolicy[] {
  const out: EmergedPolicy[] = [];
  if (patterns.some((p) => p.id === "sat")) {
    out.push({
      id: "e1",
      rule: "Antes de saturação >82%, antecipar saída em 15 min (simulado).",
      basis: "Padrão de saturação minerado",
    });
  }
  if (snap.estadiaCrit > 0) {
    out.push({
      id: "e2",
      rule: `Dwell crítico (${snap.estadiaCrit} u.) costuma preceder gargalo — checklist duplo em horário de pico.`,
      basis: "SLA + histórico de throughput",
    });
  }
  if (patterns.some((p) => p.id === "hour")) {
    out.push({
      id: "e3",
      rule: "Entre 9–17h, reduzir batch de alterações manuais em solicitações (política emergente).",
      basis: "Clusters horários críticos",
    });
  }
  if (!out.length) {
    out.push({
      id: "e0",
      rule: "Manter observação — políticas emergentes aguardam densidade mínima de sinais.",
      basis: "Insuficiência de padrão forte",
    });
  }
  return out.slice(0, 6);
}

export function finInadimplenciaPct(fin: Record<string, unknown> | null): number | null {
  if (!fin) return null;
  const raw = (fin.inadimplencia as { taxaInadimplenciaGeralPercent?: number | null } | undefined)?.taxaInadimplenciaGeralPercent;
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}

export function perfSeriePeak(perf: Record<string, unknown> | null): number {
  const s = perf?.series as { produtividadeDiaria30d?: { operacoes?: number }[] } | undefined;
  const arr = s?.produtividadeDiaria30d ?? [];
  let m = 0;
  for (const d of arr) {
    const o = Number(d?.operacoes ?? 0);
    if (o > m) m = o;
  }
  return m;
}
