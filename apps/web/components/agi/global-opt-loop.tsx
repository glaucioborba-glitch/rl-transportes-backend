"use client";

import type { GlobalOptObjective } from "@/lib/agi/self-optimizing-logic";
import { cn } from "@/lib/utils";

export function GlobalOptLoop({ objectives }: { objectives: GlobalOptObjective[] }) {
  return (
    <div className="rounded-2xl border border-indigo-500/30 bg-[#060818] p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-indigo-300/90">Global optimization loop</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {objectives.map((o) => (
          <div key={o.id} className="rounded-xl border border-white/10 bg-black/40 px-3 py-2">
            <p className="text-[10px] font-bold uppercase text-zinc-500">{o.label}</p>
            <p className="mt-1 font-mono text-lg text-white">{o.value}</p>
            <p
              className={cn(
                "text-[10px]",
                o.trend === "up" ? "text-emerald-400" : o.trend === "down" ? "text-sky-400" : "text-zinc-600",
              )}
            >
              tendência: {o.trend}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
