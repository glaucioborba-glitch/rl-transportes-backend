"use client";

import { useMemo, useState, useCallback } from "react";
import { AutopilotLoop } from "@/components/sdt/autopilot-loop";
import { FlowRebalancer } from "@/components/sdt/flow-rebalancer";
import { OperationalPlaybooks } from "@/components/sdt/operational-playbooks";
import { SimulationCanvas } from "@/components/sdt/simulation-canvas";
import { ConstraintChecker } from "@/components/sdt/constraint-checker";
import { ActionSynthesizer } from "@/components/sdt/action-synthesizer";
import { PriorityEngine } from "@/components/sdt/priority-engine";
import { useSdtBundle } from "@/lib/sdt/use-sdt-bundle";
import {
  buildApsPriorities,
  synthesizeActions,
} from "@/lib/sdt/decision-engine-core";
import { maxGargaloProb } from "@/lib/ai-console/operational-snapshot";
import type { SynthesizedAction } from "@/lib/sdt/decision-engine-core";
import type { Playbook } from "@/lib/sdt/playbooks";
import { Button } from "@/components/ui/button";

export default function SdtAutopilotPage() {
  const [pollMs, setPollMs] = useState<number | null>(60_000);
  const effectivePoll = pollMs ?? 0;
  const { bundle, snap, refresh } = useSdtBundle(effectivePoll > 0 ? effectivePoll : null, { includeTurnos: true });

  const [playbookActions, setPlaybookActions] = useState<SynthesizedAction[] | null>(null);
  const [lastPb, setLastPb] = useState<Playbook | null>(null);

  const iaProb = useMemo(() => maxGargaloProb(bundle?.gar ?? null), [bundle?.gar]);
  const priorities = useMemo(() => (snap ? buildApsPriorities(snap, iaProb) : []), [snap, iaProb]);
  const baseActions = useMemo(() => (snap ? synthesizeActions(snap, priorities) : []), [snap, priorities]);
  const actions = playbookActions ?? baseActions;
  const constraintProbe = actions[0]?.label ?? "";

  const onPick = useCallback((a: SynthesizedAction[], pb: Playbook) => {
    setPlaybookActions(a);
    setLastPb(pb);
  }, []);

  if (!bundle || !snap) {
    return (
      <div className="space-y-4">
        <p className="text-zinc-500">Carregando autopilot…</p>
        <Button type="button" variant="outline" className="border-emerald-500/40" onClick={() => void refresh()}>
          Tentar agora
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-light text-white">Autopilot engine</h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-500">
            Loop autônomo simulado + playbooks. Inclui sonda de turnos quando permitido. Frequência configurável abaixo.
          </p>
        </div>
        <Button type="button" variant="outline" className="border-emerald-500/40" onClick={() => void refresh()}>
          Sync manual
        </Button>
      </div>

      <AutopilotLoop pollMs={pollMs} onPollMsChange={setPollMs} onCycle={() => void refresh()} lastUpdated={bundle.updatedAt} />

      <div className="grid gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-7">
          <FlowRebalancer snap={snap} />
          <OperationalPlaybooks onPick={onPick} />
          {lastPb ? (
            <p className="text-[11px] text-zinc-500">
              Playbook ativo: <span className="text-emerald-300">{lastPb.title}</span> — ações substituem síntese base até nova seleção.
            </p>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <PriorityEngine items={priorities.slice(0, 5)} />
            <ActionSynthesizer actions={actions} />
          </div>
        </div>
        <div className="space-y-4 xl:col-span-5">
          <SimulationCanvas satPct={snap.sat} active={pollMs != null} />
          <ConstraintChecker snap={snap} iaProb={iaProb} actionLabel={constraintProbe} />
          {bundle.turnos != null ? (
            <p className="text-[10px] text-zinc-600">Dados de /simulador/turnos disponíveis para correlação local.</p>
          ) : (
            <p className="text-[10px] text-zinc-600">Turnos não disponíveis (403/permissão) — autopilot usa demais fontes.</p>
          )}
        </div>
      </div>
    </div>
  );
}
