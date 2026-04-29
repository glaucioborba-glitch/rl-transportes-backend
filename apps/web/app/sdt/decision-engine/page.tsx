"use client";

import { useMemo } from "react";
import { DecisionStateInterpreter } from "@/components/sdt/decision-state-interpreter";
import { PriorityEngine } from "@/components/sdt/priority-engine";
import { ActionSynthesizer } from "@/components/sdt/action-synthesizer";
import { ExecutionSimulator } from "@/components/sdt/execution-simulator";
import { AutoDiagnosisPanel } from "@/components/sdt/auto-diagnosis-panel";
import { useSdtBundle } from "@/lib/sdt/use-sdt-bundle";
import {
  buildApsPriorities,
  buildAutoDiagnosis,
  buildExecutionTimeline,
  interpretSdtPhase,
  synthesizeActions,
} from "@/lib/sdt/decision-engine-core";
import { maxGargaloProb } from "@/lib/ai-console/operational-snapshot";
import { Button } from "@/components/ui/button";

export default function SdtDecisionEnginePage() {
  const { bundle, snap, refresh } = useSdtBundle(10_000, { includeTurnos: false });

  const iaProb = useMemo(() => maxGargaloProb(bundle?.gar ?? null), [bundle?.gar]);
  const phase = useMemo(() => (snap ? interpretSdtPhase(snap, bundle?.gar ?? null) : "normal"), [snap, bundle?.gar]);
  const priorities = useMemo(() => (snap ? buildApsPriorities(snap, iaProb) : []), [snap, iaProb]);
  const actions = useMemo(() => (snap ? synthesizeActions(snap, priorities) : []), [snap, priorities]);
  const steps = useMemo(() => (snap ? buildExecutionTimeline(snap, actions) : []), [snap, actions]);
  const diag = useMemo(() => (snap ? buildAutoDiagnosis(snap, iaProb) : []), [snap, iaProb]);

  if (!bundle || !snap) {
    return (
      <div className="space-y-4">
        <p className="text-zinc-500">Carregando decision engine…</p>
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
          <h1 className="text-3xl font-light text-white">Decision engine</h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-500">
            Motor de decisões autônomas (simulação). Dados: dashboard, performance, capacidade, projeção, solicitações,
            IA gargalos. Atualização ~10s.
            {bundle.prevNote ? " Sonda /ia-operacional/previsoes ativa." : ""}
          </p>
        </div>
        <Button type="button" variant="outline" className="border-emerald-500/40" onClick={() => void refresh()}>
          Sincronizar
        </Button>
      </div>

      <DecisionStateInterpreter
        phase={phase}
        tpPortaria={snap.tpPortaria}
        tpGate={snap.tpGate}
        sat={snap.sat}
        dwellCrit={snap.estadiaCrit}
        retr={snap.retr}
        iaProbPct={iaProb * 100}
        violacoes={snap.vb}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <PriorityEngine items={priorities} />
        <ActionSynthesizer actions={actions} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ExecutionSimulator steps={steps} />
        <AutoDiagnosisPanel lines={diag} />
      </div>
    </div>
  );
}
