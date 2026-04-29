"use client";

import { useEffect, useState } from "react";
import { OPT_CYCLE_ORDER, type OptCycleStep } from "@/lib/aog/regulation-logic";
import { cn } from "@/lib/utils";

const LABEL: Record<OptCycleStep, string> = {
  observar: "Observar",
  decidir: "Decidir",
  simular: "Simular",
  reavaliar: "Reavaliar",
  memoria: "Memória heurística",
};

export function OptimizationCycle({ active }: { active: boolean }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setI((x) => (x + 1) % OPT_CYCLE_ORDER.length), 2200);
    return () => clearInterval(t);
  }, [active]);

  return (
    <div className="rounded-2xl border border-slate-600/40 bg-[#050508] p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-zinc-500">Auto-optimization cycle</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {OPT_CYCLE_ORDER.map((step, idx) => (
          <div
            key={step}
            className={cn(
              "rounded-lg px-3 py-2 font-mono text-[11px]",
              active && idx === i ? "bg-indigo-600/30 text-indigo-100 ring-1 ring-indigo-400/40" : "bg-black/40 text-zinc-600",
            )}
          >
            {idx + 1}. {LABEL[step]}
          </div>
        ))}
      </div>
      <p className="mt-3 text-[10px] text-zinc-600">Laço local: observar → decidir → simular → reavaliar → armazenar heurística (sem persistência backend).</p>
    </div>
  );
}
