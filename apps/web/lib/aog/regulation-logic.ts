import type { OperationalSnapshot } from "@/lib/ai-console/operational-snapshot";
import type { IaGargaloBlob } from "@/lib/ai-console/operational-snapshot";

export type SimulatedResponse = { id: string; label: string; trigger: string };

export function autoRegulatorResponses(snap: OperationalSnapshot, iaProb: number): SimulatedResponse[] {
  const r: SimulatedResponse[] = [];
  if (snap.sat > 88) {
    r.push({
      id: "r1",
      trigger: "Saturação crítica",
      label: "Ajuste de fluxo: reduzir gate-in simulado e priorizar saída",
    });
  }
  if (snap.filaLens.gate > 12 || snap.taxaGargalo) {
    r.push({
      id: "r2",
      trigger: "Fila gate anormal",
      label: "Mudança de prioridade: docas expressas virtuais",
    });
  }
  if (iaProb > 0.55) {
    r.push({
      id: "r3",
      trigger: "IA prevê gargalo",
      label: "Mitigação: reforço de turno e contingência operativa",
    });
  }
  if (snap.vb > 0) {
    r.push({
      id: "r4",
      trigger: "Violação ativa",
      label: "Integrity hold: bloqueio virtual de avanço até saneamento",
    });
  }
  if (!r.length) {
    r.push({ id: "r0", trigger: "Estável", label: "Manter políticas atuais; observar próximo ciclo" });
  }
  return r;
}

export type AdaptiveRule = { id: string; condition: string; action: string; active: boolean };

export function adaptiveGovernanceRules(args: {
  hour: number;
  satPct: number;
  demandProxy: number;
  humanStress: number;
}): AdaptiveRule[] {
  const peak = args.hour >= 8 && args.hour <= 18;
  return [
    {
      id: "a1",
      condition: peak ? "Horário comercial (8–18h)" : "Fora do pico",
      action: peak ? "Reforço de verificação em gate" : "Cadência relaxada com alertas IA",
      active: peak,
    },
    {
      id: "a2",
      condition: `Demanda proxy ${args.demandProxy}`,
      action: args.demandProxy > 70 ? "Expandir prioridade de saída" : "Distribuir janelas de entrada",
      active: true,
    },
    {
      id: "a3",
      condition: `Saturação ${args.satPct.toFixed(0)}%`,
      action: args.satPct > 80 ? "Política anti-overflow automática (sim)" : "Throughput máximo dentro do SLA",
      active: args.satPct > 65,
    },
    {
      id: "a4",
      condition: `Stress humano ${args.humanStress}`,
      action: args.humanStress > 65 ? "Pausas obrigatórias + dupla verificação" : "Checklist leve",
      active: true,
    },
  ];
}

export type FailSafeHit = { id: string; blocked: string; reason: string };

export function failSafeLayer(args: {
  snap: OperationalSnapshot;
  iaProb: number;
  proposedAction: string;
}): FailSafeHit[] {
  const hits: FailSafeHit[] = [];
  const a = args.proposedAction.toLowerCase();
  if (args.snap.sat > 92 && a.includes("entrada") && !a.includes("reduz")) {
    hits.push({
      id: "f1",
      blocked: "Aumentar entrada sem despressurização",
      reason: "Fail-safe: saturação >92%",
    });
  }
  if (args.iaProb > 0.72 && a.includes("reduz") && a.includes("saída")) {
    hits.push({
      id: "f2",
      blocked: "Cortar gate-out",
      reason: "Fail-safe: risco IA elevado — manter saída mínima",
    });
  }
  if (args.snap.vb > 0 && a.includes("ignorar")) {
    hits.push({
      id: "f3",
      blocked: "Ignorar não conformidade",
      reason: "Fail-safe: integridade operacional",
    });
  }
  return hits;
}

export type PolicyDef = {
  id: string;
  title: string;
  description: string;
  defaultOn: boolean;
  evaluate: (ctx: { satPct: number; iaProb: number; snap: OperationalSnapshot; gar: IaGargaloBlob }) => "pass" | "warn" | "trip";
};

export const AOG_POLICY_LIBRARY: PolicyDef[] = [
  {
    id: "p_sat",
    title: "Teto de saturação",
    description: "Nunca ultrapassar 90% saturação sem ação mitigatória.",
    defaultOn: true,
    evaluate: ({ satPct }) => (satPct >= 90 ? "trip" : satPct >= 78 ? "warn" : "pass"),
  },
  {
    id: "p_quad",
    title: "Quadra crítica",
    description: "Isolar virtualmente quadra crítica acima de limite.",
    defaultOn: true,
    evaluate: ({ snap }) => (snap.sat > 85 && snap.filaLens.patio > 8 ? "warn" : "pass"),
  },
  {
    id: "p_ia",
    title: "Reforço com previsão IA",
    description: "Reforço de equipes quando IA prever gargalo >55%.",
    defaultOn: true,
    evaluate: ({ iaProb }) => (iaProb > 0.65 ? "trip" : iaProb > 0.55 ? "warn" : "pass"),
  },
  {
    id: "p_flow",
    title: "Desvio de fluxo sob risco",
    description: "Desviar fluxo quando NC + saturação simultâneas.",
    defaultOn: false,
    evaluate: ({ snap }) => (snap.vb > 0 && snap.sat > 80 ? "trip" : "pass"),
  },
];

export function evaluatePolicies(
  enabled: Record<string, boolean>,
  ctx: { satPct: number; iaProb: number; snap: OperationalSnapshot; gar: IaGargaloBlob },
): { id: string; title: string; status: "pass" | "warn" | "trip" }[] {
  return AOG_POLICY_LIBRARY.filter((p) => enabled[p.id] !== false).map((p) => ({
    id: p.id,
    title: p.title,
    status: p.evaluate(ctx),
  }));
}

export type OptCycleStep = "observar" | "decidir" | "simular" | "reavaliar" | "memoria";

export const OPT_CYCLE_ORDER: OptCycleStep[] = ["observar", "decidir", "simular", "reavaliar", "memoria"];
