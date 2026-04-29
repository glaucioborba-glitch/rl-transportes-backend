"use client";

import type { TunedRule } from "@/lib/agi/self-learning-logic";
import { cn } from "@/lib/utils";

export function SelfTuningRules({ rules }: { rules: TunedRule[] }) {
  return (
    <div className="rounded-2xl border border-cyan-500/25 bg-[#050c12] p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-cyan-300/80">Self‑tuning rules · 7 / 14 / 30 dias (sim)</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {rules.map((r) => (
          <div
            key={r.id}
            className={cn(
              "rounded-xl border p-3 transition-transform duration-700",
              r.window === "7d"
                ? "border-amber-500/35 bg-amber-950/20"
                : r.window === "14d"
                  ? "border-cyan-500/35 bg-cyan-950/15"
                  : "border-indigo-500/35 bg-indigo-950/20",
            )}
          >
            <p className="text-[10px] font-bold uppercase text-zinc-400">{r.name}</p>
            <dl className="mt-3 space-y-1.5 font-mono text-[11px] text-zinc-300">
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Limite sat.</dt>
                <dd>{r.satLimitPct}%</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Risco thresh.</dt>
                <dd>{r.riskThreshold}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Peso prio.</dt>
                <dd>{r.priorityWeight.toFixed(2)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Reavaliação</dt>
                <dd>{r.reevalHours}h</dd>
              </div>
            </dl>
            <p className="mt-2 text-[10px] text-zinc-600">{r.note}</p>
          </div>
        ))}
      </div>
    </div>
  );
}