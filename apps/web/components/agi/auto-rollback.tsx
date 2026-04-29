"use client";

import type { RollbackStep } from "@/lib/agi/self-correcting-logic";

export function AutoRollback({ steps }: { steps: RollbackStep[] }) {
  return (
    <div className="rounded-2xl border border-slate-500/40 bg-[#06060a] p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-slate-300">Auto‑rollback · simulação</p>
      <ol className="mt-4 space-y-3">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3 border-l-2 border-violet-500/50 pl-3">
            <span className="shrink-0 font-mono text-[10px] text-violet-400">{s.t}</span>
            <p className="text-xs text-zinc-400">{s.detail}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
