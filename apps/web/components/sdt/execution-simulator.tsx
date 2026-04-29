"use client";

import { useEffect, useState } from "react";
import type { SimStep } from "@/lib/sdt/decision-engine-core";

export function ExecutionSimulator({ steps }: { steps: SimStep[] }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (steps.length <= 1) return;
    const t = setInterval(() => {
      setIdx((i) => (i + 1 >= steps.length ? 0 : i + 1));
    }, 2400);
    return () => clearInterval(t);
  }, [steps.length]);

  const cur = steps[Math.min(idx, steps.length - 1)] ?? steps[0];
  if (!cur) return null;

  return (
    <div className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-[#051208] to-[#020806] p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-300/80">Execution simulator · timeline</p>
      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>
            Passo {cur.step} / {steps.length - 1}
          </span>
          <span className="font-mono text-emerald-400/90">ROI acum. (passo) +{cur.roiProxyPct.toFixed(1)}% produtividade proxy</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full bg-gradient-to-r from-emerald-600 to-cyan-400 transition-all duration-700"
            style={{ width: `${(cur.step / Math.max(1, steps.length - 1)) * 100}%` }}
          />
        </div>
        <p className="text-sm font-medium text-white">{cur.label}</p>
        <p className="text-xs text-zinc-400">
          Estado projetado: <strong className="text-emerald-200">{cur.stateAfter}</strong> · saturação{" "}
          <strong className="text-white">{cur.satPct.toFixed(1)}%</strong>
        </p>
      </div>
    </div>
  );
}
