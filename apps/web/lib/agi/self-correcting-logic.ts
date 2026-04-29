import type { OperationalSnapshot } from "@/lib/ai-console/operational-snapshot";

export type FailureSignal = { key: string; label: string; weight: number };

export function failureSignals(args: {
  snap: OperationalSnapshot;
  iaRisk01: number;
  throughputUnstable: boolean;
}): { score: number; signals: FailureSignal[] } {
  const signals: FailureSignal[] = [];
  let acc = 0;
  if (args.snap.filaLens.gate + args.snap.filaLens.portaria > 18) {
    signals.push({ key: "cong", label: "Congestionamento multiestágio", weight: 22 });
    acc += 22;
  }
  if (args.snap.sat > 82) {
    signals.push({ key: "sat", label: "Saturação elevada", weight: 20 });
    acc += 20;
  }
  if (args.throughputUnstable) {
    signals.push({ key: "thr", label: "Throughput instável P×G", weight: 18 });
    acc += 18;
  }
  if (args.iaRisk01 > 0.55) {
    signals.push({ key: "ia", label: "Risco IA (previsão/gargalo proxy)", weight: Math.round(args.iaRisk01 * 28) });
    acc += Math.round(args.iaRisk01 * 28);
  }
  if (args.snap.retr > 0.12) {
    signals.push({ key: "hum", label: "Retrabalho alto (proxy comportamento)", weight: 16 });
    acc += 16;
  }
  if (args.snap.vb > 0) {
    signals.push({ key: "nc", label: "Não conformidade ativa", weight: 14 });
    acc += 14;
  }
  const score = Math.min(100, acc);
  if (!signals.length) {
    signals.push({ key: "ok", label: "Estabilidade relativa", weight: 0 });
  }
  return { score, signals };
}

export type ContainmentAction = { id: string; label: string; active: boolean };

export function autoContainmentPlan(snap: OperationalSnapshot): ContainmentAction[] {
  const iso = snap.sat > 80 || snap.filaLens.patio > 10;
  return [
    { id: "c1", label: "Isolar quadras críticas (virtual)", active: iso },
    { id: "c2", label: "Limitar entrada simulada", active: snap.sat > 76 },
    { id: "c3", label: "Reforço de saída / docas expressas", active: snap.filaLens.saida > 6 },
    { id: "c4", label: "Redirecionar fluxo para pátio secundário", active: snap.filaLens.gate > snap.filaLens.portaria + 4 },
  ];
}

export type RollbackStep = { t: string; detail: string };

export function simulateRollback(args: { snap: OperationalSnapshot; lastAction: string }): RollbackStep[] {
  return [
    { t: "T−0", detail: `Última ação simulada: «${args.lastAction}» — avaliando delta de risco.` },
    {
      t: "T−1",
      detail:
        args.snap.sat > 85
          ? "Reversão: reduzir pressão de entrada 12% · restabelecer estado de segurança."
          : "Reversão leve: manter throughput, apenas ajustar prioridade de verificação.",
    },
    {
      t: "T−2",
      detail: `Estado futuro recalculado — saturação projetada ~${Math.max(40, args.snap.sat - 6).toFixed(0)}% após rollback.`,
    },
  ];
}

export type StabilizerKnob = { id: string; label: string; value: string; delta: string };

export function stateStabilizerKnobs(args: { snap: OperationalSnapshot; failScore: number }): StabilizerKnob[] {
  const stress = args.failScore / 100;
  const th = (68 + stress * 22).toFixed(1);
  const w = (1 - stress * 0.25).toFixed(2);
  return [
    { id: "k1", label: "Threshold de saturação", value: `${th}%`, delta: stress > 0.5 ? "−4% sensibilidade" : "neutro" },
    { id: "k2", label: "Peso prioridade saída", value: w, delta: stress > 0.5 ? "+0.12" : "+0.04" },
    { id: "k3", label: "Tempo reavaliação (min)", value: String(Math.round(8 + args.snap.estadiaCrit * 3)), delta: "adaptativo" },
    { id: "k4", label: "Janela gate vs portaria", value: args.snap.tpGate >= args.snap.tpPortaria ? "balance→gate" : "balance→portaria", delta: "auto" },
  ];
}

export function failSafeActive(failScore: number): boolean {
  return failScore > 80;
}

export function iaRiskFromPrevisoes(prev: unknown, prevNote: boolean): number {
  if (!prev || !prevNote) return prevNote ? 0.42 : 0;
  if (typeof prev === "object" && prev !== null) {
    const o = prev as Record<string, unknown>;
    const candidates = ["riscoGargalo", "probabilidadeGargalo", "score", "nivelRisco"];
    for (const k of candidates) {
      const v = o[k];
      if (typeof v === "number" && Number.isFinite(v)) return v <= 1 ? v : Math.min(1, v / 100);
    }
  }
  return 0.48;
}

export function throughputUnstable(snap: OperationalSnapshot): boolean {
  if (snap.tpPortaria <= 0.5 && snap.tpGate <= 0.5) return false;
  const m = Math.max(snap.tpPortaria, snap.tpGate, 1e-6);
  return Math.abs(snap.tpPortaria - snap.tpGate) / m > 0.48;
}
