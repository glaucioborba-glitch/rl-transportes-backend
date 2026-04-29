"use client";

import type { SynthesizedAction } from "@/lib/sdt/decision-engine-core";

export function ActionSynthesizer({ actions }: { actions: SynthesizedAction[] }) {
  return (
    <div className="rounded-2xl border border-violet-500/20 bg-[#0a0814] p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-violet-300/80">Action synthesizer · simulado</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {actions.map((a) => (
          <div
            key={a.id}
            className="rounded-full border border-violet-500/30 bg-violet-950/40 px-4 py-2 text-xs text-violet-100"
          >
            <span className="font-semibold">{a.label}</span>
            <span className="ml-2 font-mono text-[10px] text-zinc-500">~{a.etaMin} min</span>
          </div>
        ))}
      </div>
    </div>
  );
}
