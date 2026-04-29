"use client";

import type { FailureSignal } from "@/lib/agi/self-correcting-logic";
import { cn } from "@/lib/utils";

export function FailurePredictor({ score, signals }: { score: number; signals: FailureSignal[] }) {
  return (
    <div className="rounded-2xl border border-red-500/35 bg-[#120508] p-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-red-300/90">Failure‑predictor</p>
        <div className="text-right">
          <p className="text-[10px] text-zinc-500">Score falha 0–100</p>
          <p
            className={cn(
              "font-mono text-3xl",
              score > 80 ? "text-red-400" : score > 55 ? "text-amber-400" : "text-emerald-400/90",
            )}
          >
            {score}
          </p>
        </div>
      </div>
      <ul className="mt-4 space-y-2">
        {signals.map((s) => (
          <li key={s.key} className="flex justify-between gap-2 rounded-lg border border-white/5 bg-black/35 px-3 py-1.5 text-[11px] text-zinc-300">
            <span>{s.label}</span>
            <span className="font-mono text-red-300/70">+{s.weight}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
