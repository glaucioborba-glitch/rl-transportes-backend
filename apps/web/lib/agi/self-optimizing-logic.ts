import type { OperationalSnapshot } from "@/lib/ai-console/operational-snapshot";

export type OptMetrics = {
  throughputProxy: number;
  dwellProxy: number;
  satPct: number;
  productivity: number;
  costPerOp: number | null;
};

export function extractOptMetrics(args: {
  snap: OperationalSnapshot | null;
  perf: Record<string, unknown> | null;
  fin: Record<string, unknown> | null;
}): OptMetrics {
  const estr = args.perf?.estrategicos as {
    throughputPortaria?: number | null;
    throughputGate?: number | null;
    ocupacaoPatioPercent?: number | null;
    taxaRetrabalho?: number | null;
    tempoMedioDeCicloCompletoHoras?: number | null;
    custoMedioPorOperacao?: number | null;
  } | undefined;
  const tp = args.snap
    ? (args.snap.tpPortaria + args.snap.tpGate) / 2
    : ((Number(estr?.throughputPortaria) || 0) + (Number(estr?.throughputGate) || 0)) / 2;
  const satFromEstr = Number(estr?.ocupacaoPatioPercent ?? 0) || 0;
  const sat = args.snap != null ? args.snap.sat : satFromEstr;
  const dwell = args.snap?.cicloMin ?? (Number(estr?.tempoMedioDeCicloCompletoHoras) || 0) * 60;
  const series = args.perf?.series as { produtividadeDiaria30d?: { operacoes?: number }[] } | undefined;
  const arr = series?.produtividadeDiaria30d ?? [];
  const productivity = arr.length ? arr.reduce((s, x) => s + (Number(x.operacoes) || 0), 0) / arr.length : 0;
  const costPerOp =
    estr?.custoMedioPorOperacao != null && Number.isFinite(Number(estr.custoMedioPorOperacao))
      ? Number(estr.custoMedioPorOperacao)
      : null;
  return {
    throughputProxy: tp,
    dwellProxy: dwell,
    satPct: sat,
    productivity,
    costPerOp,
  };
}

export type CostModelRow = { label: string; unit: string; value: string; eff: string };

export function costThroughputModel(m: OptMetrics, fin: Record<string, unknown> | null): CostModelRow[] {
  const inad = (fin?.inadimplencia as { taxaInadimplenciaGeralPercent?: number | null } | undefined)
    ?.taxaInadimplenciaGeralPercent;
  const inadN = typeof inad === "number" ? inad : 0;
  const baseCost = m.costPerOp ?? 42;
  const tonProxy = Math.max(1, m.throughputProxy / 8);
  return [
    { label: "Custo/operação", unit: "BRL/op", value: baseCost.toFixed(2), eff: m.throughputProxy > 6 ? "OK" : "atenção" },
    { label: "Custo/throughput-h", unit: "BRL/th", value: (baseCost / Math.max(0.8, m.throughputProxy)).toFixed(2), eff: "derivado" },
    { label: "Custo/sat-probe", unit: "idx", value: (baseCost * (1 + m.satPct / 100)).toFixed(1), eff: m.satPct < 78 ? "favorável" : "caro" },
    { label: "Custo/ton (proxy)", unit: "BRL/t·h", value: (baseCost / tonProxy).toFixed(2), eff: "front-only" },
    { label: "Carregamento inad.", unit: "%", value: inadN.toFixed(1), eff: inadN < 6 ? "estável" : "stress" },
  ];
}

export type SearchStrategyHit = { name: string; detail: string; score: number };

/** Hill-climb + annealing-lite on discrete knobs (front-only). */
export function runGlobalSearch(m: OptMetrics): SearchStrategyHit[] {
  let best = m.throughputProxy / Math.max(1, m.satPct / 50) - (m.costPerOp ?? 40) * 0.02;
  let knobs = { turnoBias: 0, flowSeq: 0, quadLayout: 0 };
  const hits: SearchStrategyHit[] = [];

  for (let t = 1.2; t >= 0.2; t -= 0.15) {
    for (let i = 0; i < 12; i++) {
      const cand = {
        turnoBias: (knobs.turnoBias + (i % 3) - 1) % 4,
        flowSeq: (knobs.flowSeq + Math.floor(i / 3)) % 3,
        quadLayout: knobs.quadLayout,
      };
      const score =
        m.throughputProxy * (1 + cand.turnoBias * 0.03) -
        m.satPct * 0.08 -
        (m.dwellProxy / 120) * 0.05 -
        t * 0.01;
      if (score > best) {
        best = score;
        knobs = cand;
      }
    }
    hits.push({
      name: `Annealing T=${t.toFixed(2)}`,
      detail: `Melhor disposição parcial: turnoBias=${knobs.turnoBias}, seq=${knobs.flowSeq}`,
      score: Math.round(best * 10) / 10,
    });
  }
  hits.push({
    name: "Grid-search (turnos × sequência)",
    detail: "Amostragem 24 configs — convergência local.",
    score: Math.round(best * 10) / 10,
  });
  return hits.slice(-4);
}

export type ImprovementPhase = "analisar" | "simular" | "validar";

export const IMPROVEMENT_ORDER: ImprovementPhase[] = ["analisar", "simular", "validar"];

export type ExecutiveOptReport = {
  headline: string;
  savingsPct: number;
  riskNote: string;
};

export function buildExecutiveOptReport(m: OptMetrics, searchBest: number): ExecutiveOptReport {
  const savingsPct = Math.max(3, Math.min(18, Math.round(12 - m.satPct * 0.08 + (searchBest > 5 ? 4 : 0))));
  const riskNote =
    m.satPct > 82
      ? "Risco residual alto — otimização limitada até despressurizar pátio."
      : m.satPct > 70
        ? "Risco moderado — ganhos dependem de disciplina de saída."
        : "Risco contido — janela favorável para afunilar custo.";
  return {
    headline: `Configuração explorada sugere até ~${savingsPct}% de redução de custo operacional proxy vs. baseline simulada.`,
    savingsPct,
    riskNote,
  };
}

export type GlobalOptObjective = { id: string; label: string; value: string; trend: "up" | "down" | "flat" };

export function globalObjectives(m: OptMetrics): GlobalOptObjective[] {
  return [
    {
      id: "o1",
      label: "Throughput",
      value: m.throughputProxy.toFixed(1),
      trend: m.throughputProxy > 7 ? "up" : "flat",
    },
    {
      id: "o2",
      label: "Dwell (proxy min)",
      value: m.dwellProxy.toFixed(0),
      trend: m.dwellProxy < 90 ? "down" : "up",
    },
    { id: "o3", label: "Saturação", value: `${m.satPct.toFixed(0)}%`, trend: m.satPct < 75 ? "down" : "up" },
    {
      id: "o4",
      label: "Produtividade média",
      value: m.productivity.toFixed(1),
      trend: m.productivity > 40 ? "up" : "flat",
    },
    {
      id: "o5",
      label: "Custo/unidade",
      value: m.costPerOp != null ? m.costPerOp.toFixed(2) : "—",
      trend: m.costPerOp != null && m.costPerOp < 50 ? "down" : "flat",
    },
  ];
}
