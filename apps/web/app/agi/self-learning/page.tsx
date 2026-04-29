"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { PatternMiner } from "@/components/agi/pattern-miner";
import { SelfTuningRules } from "@/components/agi/self-tuning-rules";
import { EvolutionLoop } from "@/components/agi/evolution-loop";
import { HeuristicMemory } from "@/components/agi/heuristic-memory";
import { PolicyEmergenceBoard } from "@/components/agi/policy-emergence-board";
import { useAgiSelfLearning } from "@/lib/agi/use-agi-self-learning";
import {
  minePatterns,
  computeSelfTuningRules,
  emergePolicies,
  finInadimplenciaPct,
  perfSeriePeak,
  loadHeuristicMemory,
  type MemoryEntry,
} from "@/lib/agi/self-learning-logic";
import { cn } from "@/lib/utils";

export default function AgiSelfLearningPage() {
  const { bundle, snap, refresh } = useAgiSelfLearning();
  const [mem, setMem] = useState<MemoryEntry[]>([]);

  useEffect(() => {
    setMem(loadHeuristicMemory());
  }, []);

  const hour = new Date().getHours();
  const relTotal = Number((bundle?.rel as { total?: number } | null)?.total ?? 0);
  const inad = finInadimplenciaPct(bundle?.fin ?? null);
  const peak = perfSeriePeak(bundle?.perf ?? null);

  const patterns = useMemo(() => {
    if (!snap) return [];
    return minePatterns({
      snap,
      relTotal,
      finInadPct: inad,
      serieOpsPeak: peak,
      hour,
    });
  }, [snap, relTotal, inad, peak, hour]);

  const tuning = useMemo(() => (snap ? computeSelfTuningRules({ snap, baseHour: hour }) : []), [snap, hour]);
  const emerged = useMemo(() => (snap ? emergePolicies(patterns, snap) : []), [snap, patterns]);

  const updated = bundle?.updatedAt ? new Date(bundle.updatedAt).toLocaleString("pt-BR") : "—";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-violet-500/20 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">AGI‑OPS · Self‑learning engine</h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-500">
            Aprendizado contínuo e auto‑ajuste heurístico. Rotas: <code className="text-zinc-600">/dashboard</code>,{" "}
            <code className="text-zinc-600">/dashboard-performance</code>, <code className="text-zinc-600">/ia-operacional/previsoes</code>,{" "}
            <code className="text-zinc-600">/relatorios/operacional/solicitacoes</code>,{" "}
            <code className="text-zinc-600">/dashboard-financeiro</code>.
          </p>
          <p className="mt-2 text-[10px] text-zinc-600">
            Prévia IA:{" "}
            <span className={cn("font-mono", bundle?.prevNote ? "text-violet-400" : "text-zinc-500")}>
              {bundle?.prevNote ? "sinal disponível" : "sem payload"}
            </span>
            <span className="mx-2">·</span>
            Atualizado: {updated}
            {bundle?.error ? <span className="ml-2 text-red-400/90">{bundle.error}</span> : null}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" className="border-violet-500/40 text-zinc-200" onClick={() => void refresh()}>
          Recarregar
        </Button>
      </div>

      {!snap ? (
        <p className="rounded-xl border border-white/10 bg-black/40 py-10 text-center text-sm text-zinc-500">Carregando…</p>
      ) : (
        <>
          <div className="grid gap-5 xl:grid-cols-2">
            <PatternMiner items={patterns} />
            <SelfTuningRules rules={tuning} />
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <EvolutionLoop active />
            <HeuristicMemory entries={mem} onChange={setMem} />
          </div>
          <PolicyEmergenceBoard policies={emerged} />
        </>
      )}
    </div>
  );
}
