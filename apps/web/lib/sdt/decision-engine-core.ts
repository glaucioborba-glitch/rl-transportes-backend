import type { OperationalSnapshot } from "@/lib/ai-console/operational-snapshot";
import { maxGargaloProb, type IaGargaloBlob } from "@/lib/ai-console/operational-snapshot";

export type SdtPhase = "normal" | "atencao" | "critico" | "colapso";

export function interpretSdtPhase(snap: OperationalSnapshot, gar: IaGargaloBlob): SdtPhase {
  const ia = maxGargaloProb(gar);
  if ((snap.vb > 0 && snap.sat > 88) || snap.sat >= 95 || (ia >= 0.72 && snap.sat > 82)) return "colapso";
  if (snap.sat >= 85 || snap.vb > 0 || ia >= 0.6 || snap.mode === "critico") return "critico";
  if (snap.sat >= 68 || snap.taxaGargalo || ia >= 0.45 || snap.mode === "congestionado" || snap.mode === "atrasado") {
    return "atencao";
  }
  return "normal";
}

export type PriorityItem = { id: string; impact: number; rule: string; action: string };

/** Autonomous Priority System — regras somente front */
export function buildApsPriorities(snap: OperationalSnapshot, iaProb: number): PriorityItem[] {
  const items: PriorityItem[] = [];
  const gateSlow = snap.tpPortaria > 0 && snap.tpGate < snap.tpPortaria * 0.75;
  if (gateSlow || snap.filaLens.gate > 8) {
    items.push({
      id: "gate-out",
      impact: 92,
      rule: "Gate lentifica → priorizar saída",
      action: "Priorizar liberações gate-out e sequência de docas",
    });
  }
  if (snap.sat > 85) {
    items.push({
      id: "patio-removal",
      impact: 88,
      rule: "Saturação > 85% → priorizar remoção",
      action: "Despressurizar pátio: movimentação interna + gate-out antecipado",
    });
  }
  if (iaProb > 0.6) {
    items.push({
      id: "contingency",
      impact: 85,
      rule: "Previsão IA > 60% → contingência",
      action: "Abrir protocolo anti-gargalo e limitar in-flow conforme capacidade",
    });
  }
  if (snap.filaLens.portaria > snap.filaLens.gate + 6) {
    items.push({
      id: "cadence",
      impact: 70,
      rule: "Pico portaria vs gate",
      action: "Escalonar janelas gate-in e validação antecipada",
    });
  }
  if (snap.retr > 0.12) {
    items.push({
      id: "retrabalho",
      impact: 62,
      rule: "Retrabalho elevado",
      action: "Realinhar instruções de pátio e conferência única",
    });
  }
  items.sort((a, b) => b.impact - a.impact);
  if (!items.length) {
    items.push({
      id: "steady",
      impact: 40,
      rule: "Operação estável",
      action: "Manter cadência; monitorar próximo horizonte IA",
    });
  }
  return items;
}

export type SynthesizedAction = { id: string; label: string; etaMin: number };

export function synthesizeActions(snap: OperationalSnapshot, priorities: PriorityItem[]): SynthesizedAction[] {
  const base: SynthesizedAction[] = [];
  const top = priorities[0];
  if (top?.id === "gate-out" || snap.taxaGargalo) {
    base.push({ id: "a1", label: "Redistribuir fila gate → docas livres", etaMin: 12 });
    base.push({ id: "a2", label: "Ativar plano anti-gargalo (gate)", etaMin: 8 });
  }
  if (snap.sat > 75) {
    base.push({ id: "a3", label: "Simular movimentação quadra saturada → buffer", etaMin: 25 });
  }
  base.push({ id: "a4", label: "Realocar operadores para estágio crítico (simulado)", etaMin: 18 });
  if (snap.vb > 0) {
    base.push({ id: "a5", label: "Congelar in-flow até saneamento de não conformidades", etaMin: 15 });
  }
  if (!base.length) {
    base.push({ id: "a0", label: "Manter rota operacional autônoma", etaMin: 5 });
  }
  return base.slice(0, 6);
}

export type SimStep = {
  step: number;
  label: string;
  stateAfter: string;
  satPct: number;
  roiProxyPct: number;
};

export function buildExecutionTimeline(snap: OperationalSnapshot, actions: SynthesizedAction[]): SimStep[] {
  let sat = snap.sat;
  const phase = (s: number) => (s < 72 ? "Fluido" : s < 85 ? "Tenso" : "Crítico");
  const steps: SimStep[] = [
    {
      step: 0,
      label: "Estado atual (baseline)",
      stateAfter: phase(sat),
      satPct: sat,
      roiProxyPct: 0,
    },
  ];
  let roi = 0;
  for (let i = 0; i < actions.length; i++) {
    const a = actions[i]!;
    const delta = -1.2 - i * 0.4 - (snap.taxaGargalo ? 0.8 : 0);
    sat = Math.max(12, Math.min(100, sat + delta));
    roi += 1.8 + i * 0.35;
    steps.push({
      step: i + 1,
      label: a.label,
      stateAfter: phase(sat),
      satPct: Math.round(sat * 10) / 10,
      roiProxyPct: Math.round(roi * 10) / 10,
    });
  }
  return steps;
}

export type DiagnosisLine = { kind: "cause" | "risk" | "opportunity"; text: string };

export function buildAutoDiagnosis(snap: OperationalSnapshot, iaProb: number): DiagnosisLine[] {
  const out: DiagnosisLine[] = [];
  if (snap.tpGate < snap.tpPortaria * 0.75 && snap.tpPortaria > 0) {
    out.push({ kind: "cause", text: "Possível propagação: gate não absorve fluxo da portaria." });
  }
  if (snap.sat > 80) {
    out.push({ kind: "risk", text: `Risco de colapso iminente se saturação permanecer >${snap.sat.toFixed(0)}% sem gate-out.` });
  }
  if (iaProb > 0.55) {
    out.push({ kind: "risk", text: `IA indica ${(iaProb * 100).toFixed(0)}% prob. de gargalo — contingência recomendada.` });
  }
  if (snap.estadiaCrit > 0) {
    out.push({ kind: "cause", text: `${snap.estadiaCrit} unidade(s) em dwell crítico amplificam fila de saída.` });
  }
  if (snap.sat < 60 && snap.retr < 0.08) {
    out.push({ kind: "opportunity", text: "Janela para acelerar turnaround e elevar throughput médio." });
  }
  if (!out.length) out.push({ kind: "opportunity", text: "Operação em faixa — otimizar pequenos tempos de ciclo." });
  return out.slice(0, 8);
}
