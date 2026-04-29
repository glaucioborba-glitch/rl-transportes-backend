"use client";

import type { MinedPattern } from "@/lib/agi/self-learning-logic";
import { cn } from "@/lib/utils";

export function PatternMiner({ items }: { items: MinedPattern[] }) {
  return (
    <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-[#0a0618] to-[#060812] p-5 shadow-[0_0_40px_rgba(99,102,241,0.08)]">
      <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-violet-300/90">Pattern miner · frente de aprendizagem</p>
      <ul className="mt-4 space-y-2">
        {items.map((p) => (
          <li
            key={p.id}
            className={cn(
              "rounded-xl border border-white/5 bg-black/35 px-3 py-2 transition-all duration-500",
              "hover:border-violet-500/30 hover:shadow-[0_0_16px_rgba(139,92,246,0.12)]",
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-white">{p.label}</span>
              <span className="font-mono text-[10px] text-emerald-400/90">{(p.confidence * 100).toFixed(0)}% conf.</span>
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">{p.detail}</p>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full animate-pulse bg-gradient-to-r from-violet-600 to-fuchsia-500"
                style={{ width: `${p.confidence * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
