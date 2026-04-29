"use client";

import type { RiskDimension } from "@/lib/aog/core-logic";

export function CrossRiskMatrix({ dimensions, grcIndex }: { dimensions: RiskDimension[]; grcIndex: number }) {
  return (
    <div className="rounded-2xl border border-slate-600/40 bg-[#0a0818] p-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-indigo-300/80">Cross-risk matrix</p>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase text-zinc-500">GRC Index</p>
          <p className="font-mono text-3xl font-light text-white">{grcIndex}</p>
          <p className="text-[10px] text-zinc-600">0 · baixo risco agregado — 100 · máximo</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {dimensions.map((d) => (
          <div key={d.key} className="rounded-xl border border-white/10 bg-black/40 p-3">
            <p className="text-[10px] font-bold uppercase text-zinc-500">{d.label}</p>
            <p className="mt-1 font-mono text-2xl text-indigo-200">{d.score}</p>
            <p className="mt-1 text-[10px] text-zinc-500">{d.note}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
              <div className="h-full bg-indigo-500/80" style={{ width: `${d.score}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
