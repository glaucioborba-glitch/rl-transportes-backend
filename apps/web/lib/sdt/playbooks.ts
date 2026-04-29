import type { SynthesizedAction } from "@/lib/sdt/decision-engine-core";

export type PlaybookId = "estavel" | "antigargalo" | "despatio" | "max-throughput" | "ultra-cta";

export type Playbook = {
  id: PlaybookId;
  title: string;
  subtitle: string;
  actions: Omit<SynthesizedAction, "id">[];
};

export const SDT_PLAYBOOKS: Playbook[] = [
  {
    id: "estavel",
    title: "Operação estável",
    subtitle: "Cadência conservadora",
    actions: [
      { label: "Manter janelas gate atuais", etaMin: 5 },
      { label: "Monitorar dwell sem intervenção agressiva", etaMin: 10 },
    ],
  },
  {
    id: "antigargalo",
    title: "Anti-gargalo",
    subtitle: "Gate + portaria",
    actions: [
      { label: "Priorizar inspeções paralelas no gate", etaMin: 8 },
      { label: "Escalonar chegadas na portaria", etaMin: 12 },
      { label: "Ativar plano anti-gargalo", etaMin: 6 },
    ],
  },
  {
    id: "despatio",
    title: "Despressurização do pátio",
    subtitle: "Movimentação interna",
    actions: [
      { label: "Simular movimentação quadra densa → buffer", etaMin: 20 },
      { label: "Antecipar gate-out prioritário", etaMin: 15 },
      { label: "Reduzir in-flow momentâneo", etaMin: 10 },
    ],
  },
  {
    id: "max-throughput",
    title: "Maximize throughput",
    subtitle: "Fluxo máximo sustentável",
    actions: [
      { label: "Balancear equipe portaria/gate", etaMin: 18 },
      { label: "Eliminar filas fantasma no pátio", etaMin: 14 },
    ],
  },
  {
    id: "ultra-cta",
    title: "Turnaround ultra-rápido",
    subtitle: "Ciclo agressivo (simulado)",
    actions: [
      { label: "Gate express para unidades pré-ok", etaMin: 6 },
      { label: "Doca dupla virtual para saída", etaMin: 9 },
      { label: "Compressão de dwell alvo -15%", etaMin: 22 },
    ],
  },
];

export function playbookToSynthesized(pb: Playbook, prefix: string): SynthesizedAction[] {
  return pb.actions.map((a, i) => ({
    id: `${prefix}-${pb.id}-${i}`,
    label: a.label,
    etaMin: a.etaMin,
  }));
}
