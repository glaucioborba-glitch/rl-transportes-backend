"use client";

import type { SearchStrategyHit } from "@/lib/agi/self-optimizing-logic";

export function SearchStrategies({ hits }: { hits: SearchStrategyHit[] }) {
  return (
    <div className="rounded-2xl border border-purple-500/30 bg-[#0a0812] p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-purple-300/90">Global search strategies</p>
      <p className="mt-2 text-[11px] text-zinc-600">Hill-climb · annealing simplificado · grid-search parcial (front-only).</p>
      <ul className="mt-4 space-y-2">
        {hits.map((h, i) => (
          <li key={i} className="rounded-lg border border-white/5 bg-black/40 px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-purple-100/90">{h.name}</span>
              <span className="font-mono text-sm text-purple-300">{h.score}</span>
            </div>
            <p className="mt-1 text-[10px] text-zinc-500">{h.detail}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
