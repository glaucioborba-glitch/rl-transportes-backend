"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { GlobalOptLoop } from "@/components/agi/global-opt-loop";
import { CostThroughputModel } from "@/components/agi/cost-throughput-model";
import { AutoImprovementCycle } from "@/components/agi/auto-improvement-cycle";
import { SearchStrategies } from "@/components/agi/search-strategies";
import { ExecutiveOptReport } from "@/components/agi/executive-opt-report";
import { useAgiSelfOptimizing } from "@/lib/agi/use-agi-self-optimizing";
import {
  extractOptMetrics,
  costThroughputModel,
  runGlobalSearch,
  buildExecutiveOptReport,
  globalObjectives,
} from "@/lib/agi/self-optimizing-logic";
import { cn } from "@/lib/utils";

export default function AgiSelfOptimizingPage() {
  const { bundle, snap, refresh } = useAgiSelfOptimizing();

  const m = useMemo(
    () => extractOptMetrics({ snap, perf: bundle?.perf ?? null, fin: bundle?.fin ?? null }),
    [snap, bundle?.perf, bundle?.fin],
  );
  const costs = useMemo(() => costThroughputModel(m, bundle?.fin ?? null), [m, bundle?.fin]);
  const search = useMemo(() => runGlobalSearch(m), [m]);
  const bestScore = search.length ? Math.max(...search.map((s) => s.score)) : 0;
  const report = useMemo(() => buildExecutiveOptReport(m, bestScore), [m, bestScore]);
  const objectives = useMemo(() => globalObjectives(m), [m]);

  const updated = bundle?.updatedAt ? new Date(bundle.updatedAt).toLocaleString("pt-BR") : "—";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-indigo-500/20 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">AGI‑OPS · Self‑optimizing engine</h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-500">
            Otimização global e economia operacional (front-only). Rotas: <code className="text-zinc-600">/simulador/expansao</code>,{" "}
            <code className="text-zinc-600">/simulador/cenario</code>, <code className="text-zinc-600">/simulador/capacidade</code>,{" "}
            <code className="text-zinc-600">/dashboard-performance</code>, <code className="text-zinc-600">/dashboard-financeiro</code>,{" "}
            <code className="text-zinc-600">/comercial/recomendacoes</code>.
          </p>
          <p className="mt-2 text-[10px] text-zinc-600">
            Snapshot sintético (perf+cap):{" "}
            <span className={cn("font-mono", snap ? "text-indigo-300" : "text-zinc-500")}>{snap ? "ativo" : "—"}</span>
            <span className="mx-2">·</span>
            Atualizado: {updated}
            {bundle?.error ? <span className="ml-2 text-red-400/90">{bundle.error}</span> : null}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" className="border-indigo-500/40 text-zinc-200" onClick={() => void refresh()}>
          Recarregar
        </Button>
      </div>

      {!snap ? (
        <p className="rounded-xl border border-white/10 bg-black/40 py-10 text-center text-sm text-zinc-500">Carregando performance…</p>
      ) : (
        <>
          <GlobalOptLoop objectives={objectives} />
          <div className="grid gap-5 xl:grid-cols-2">
            <CostThroughputModel rows={costs} />
            <SearchStrategies hits={search} />
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <AutoImprovementCycle active />
            <ExecutiveOptReport report={report} />
          </div>
          {(bundle?.expansao || bundle?.cenario || bundle?.rec) && (
            <p className="rounded-lg border border-white/5 bg-black/30 px-3 py-2 text-[10px] text-zinc-600">
              Contexto simulador carregado: expansão={bundle?.expansao ? "sim" : "—"} · cenário={bundle?.cenario ? "sim" : "—"} ·
              recomendações={bundle?.rec ? "sim" : "—"}.
            </p>
          )}
        </>
      )}
    </div>
  );
}
