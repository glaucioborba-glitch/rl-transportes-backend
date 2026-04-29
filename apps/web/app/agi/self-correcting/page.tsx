"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { FailurePredictor } from "@/components/agi/failure-predictor";
import { ContainmentSimulator } from "@/components/agi/containment-simulator";
import { AutoRollback } from "@/components/agi/auto-rollback";
import { StateStabilizer } from "@/components/agi/state-stabilizer";
import { FailSafePanel } from "@/components/agi/fail-safe-panel";
import { useAgiSelfCorrecting } from "@/lib/agi/use-agi-self-correcting";
import {
  failureSignals,
  autoContainmentPlan,
  simulateRollback,
  stateStabilizerKnobs,
  failSafeActive,
  iaRiskFromPrevisoes,
  throughputUnstable,
} from "@/lib/agi/self-correcting-logic";
import { cn } from "@/lib/utils";

export default function AgiSelfCorrectingPage() {
  const { bundle, snap, refresh } = useAgiSelfCorrecting();
  const [lastAction, setLastAction] = useState("Aumentar lote de entrada prioritária");

  const iaRisk = useMemo(
    () => iaRiskFromPrevisoes(bundle?.prev ?? null, bundle?.prevNote ?? false),
    [bundle?.prev, bundle?.prevNote],
  );

  const unstable = snap ? throughputUnstable(snap) : false;
  const pred = useMemo(
    () =>
      snap
        ? failureSignals({
            snap,
            iaRisk01: iaRisk,
            throughputUnstable: unstable,
          })
        : { score: 0, signals: [{ key: "load", label: "Aguardando dados", weight: 0 }] },
    [snap, iaRisk, unstable],
  );

  const containment = snap ? autoContainmentPlan(snap) : [];
  const rollback = snap ? simulateRollback({ snap, lastAction }) : [];
  const knobs = snap ? stateStabilizerKnobs({ snap, failScore: pred.score }) : [];
  const fs = failSafeActive(pred.score);

  const updated = bundle?.updatedAt ? new Date(bundle.updatedAt).toLocaleString("pt-BR") : "—";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-red-500/20 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">AGI‑OPS · Self‑correcting engine</h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-500">
            Autocorreção e anti‑colapso simulados. Rotas: <code className="text-zinc-600">/dashboard</code>,{" "}
            <code className="text-zinc-600">/dashboard-performance</code>, <code className="text-zinc-600">/simulador/cenario</code>,{" "}
            <code className="text-zinc-600">/simulador/capacidade</code>, <code className="text-zinc-600">/ia-operacional/previsoes</code>.
          </p>
          <p className="mt-2 text-[10px] text-zinc-600">
            IA:{" "}
            <span className={cn("font-mono", bundle?.prevNote ? "text-red-300/80" : "text-zinc-500")}>
              {bundle?.prevNote ? `risco proxy ${(iaRisk * 100).toFixed(0)}%` : "sem sinal"}
            </span>
            <span className="mx-2">·</span>
            Atualizado: {updated}
            {bundle?.error ? <span className="ml-2 text-red-400/90">{bundle.error}</span> : null}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" className="border-red-500/40 text-zinc-200" onClick={() => void refresh()}>
          Recarregar
        </Button>
      </div>

      {!snap ? (
        <p className="rounded-xl border border-white/10 bg-black/40 py-10 text-center text-sm text-zinc-500">Carregando…</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {["Priorizar saída expressa", "Reduzir entrada agressiva", "Dupla verificação em gate"].map((a) => (
              <Button
                key={a}
                type="button"
                size="sm"
                variant="outline"
                className="bg-white/5 text-[11px] text-zinc-300"
                onClick={() => setLastAction(a)}
              >
                Cenário: {a}
              </Button>
            ))}
          </div>
          <FailurePredictor score={pred.score} signals={pred.signals} />
          <div className="grid gap-5 xl:grid-cols-2">
            <ContainmentSimulator actions={containment} />
            <AutoRollback steps={rollback} />
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <StateStabilizer knobs={knobs} />
            <FailSafePanel active={fs} score={pred.score} />
          </div>
        </>
      )}
    </div>
  );
}
