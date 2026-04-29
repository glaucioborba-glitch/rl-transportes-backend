"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { AutoRegulator } from "@/components/aog/auto-regulator";
import { AdaptiveGovernance } from "@/components/aog/adaptive-governance";
import { FailSafeLayer } from "@/components/aog/fail-safe-layer";
import { PolicyEngine } from "@/components/aog/policy-engine";
import { OptimizationCycle } from "@/components/aog/optimization-cycle";
import { useAogRegulation } from "@/lib/aog/use-aog-regulation";
import {
  autoRegulatorResponses,
  adaptiveGovernanceRules,
  failSafeLayer,
} from "@/lib/aog/regulation-logic";
import { maxGargaloProb } from "@/lib/ai-console/operational-snapshot";
import { cn } from "@/lib/utils";

export default function AogSelfRegulationPage() {
  const { bundle, snap, refresh } = useAogRegulation();
  const hour = new Date().getHours();

  const iaProb = maxGargaloProb(bundle?.gar ?? null);
  const satPct = snap?.sat ?? 0;

  const responses = useMemo(
    () => (snap ? autoRegulatorResponses(snap, iaProb) : []),
    [snap, iaProb],
  );

  const rules = useMemo(() => {
    const fila = snap?.filaLens;
    const demandProxy = fila
      ? Math.min(100, Math.round((fila.portaria + fila.gate + fila.patio + fila.saida) * 2.2))
      : 40;
    const humanStress = Math.min(100, Math.round((snap?.retr ?? 0) * 100 + (satPct > 72 ? 18 : 0)));
    return adaptiveGovernanceRules({ hour, satPct, demandProxy, humanStress });
  }, [hour, satPct, snap?.filaLens, snap?.retr]);
  // hour recalculates each render / poll tick via parent re-renders

  const failHits = useMemo(
    () =>
      snap
        ? failSafeLayer({
            snap,
            iaProb,
            proposedAction: "Aumentar entrada agressiva sem despressurizar filas",
          })
        : [],
    [snap, iaProb],
  );

  const cycleActive = Boolean(snap && snap.sat < 96);
  const updated = bundle?.updatedAt ? new Date(bundle.updatedAt).toLocaleString("pt-BR") : "—";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-emerald-900/30 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">AOG · Self-regulation engine</h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-500">
            Governança adaptativa e autocorreção simulada. Leitura: <code className="text-zinc-600">/dashboard</code>,{" "}
            <code className="text-zinc-600">/dashboard-performance</code>, <code className="text-zinc-600">/simulador/capacidade</code>,{" "}
            <code className="text-zinc-600">/simulador/cenario</code>, <code className="text-zinc-600">/comercial/recomendacoes</code>, sondas{" "}
            <code className="text-zinc-600">/ia-operacional/previsoes</code> e <code className="text-zinc-600">/ia/gargalos</code>.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-zinc-600">
            <span>
              IA prévia:{" "}
              <span className={cn("font-mono", bundle?.prevNote ? "text-emerald-400" : "text-zinc-500")}>
                {bundle?.prevNote ? "endpoint respondeu" : "sem sinal / indisponível"}
              </span>
            </span>
            <span>·</span>
            <span>
              Gargalo máx. (proxy): <span className="font-mono text-zinc-400">{(iaProb * 100).toFixed(0)}%</span>
            </span>
            <span>·</span>
            <span>Atualizado: {updated}</span>
            {bundle?.error ? (
              <>
                <span>·</span>
                <span className="text-red-400/90">{bundle.error}</span>
              </>
            ) : null}
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" className="border-emerald-700/40 text-zinc-200" onClick={() => void refresh()}>
          Recarregar
        </Button>
      </div>

      {!snap ? (
        <p className="rounded-xl border border-white/10 bg-black/40 px-4 py-8 text-center text-sm text-zinc-500">
          Carregando snapshot…
        </p>
      ) : (
        <>
          <div className="grid gap-5 xl:grid-cols-2">
            <AutoRegulator items={responses} />
            <AdaptiveGovernance rules={rules} />
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <FailSafeLayer hits={failHits} />
            <PolicyEngine snap={snap} gar={bundle?.gar ?? null} iaProb={iaProb} satPct={satPct} />
          </div>
          <OptimizationCycle active={cycleActive} />
        </>
      )}
    </div>
  );
}
