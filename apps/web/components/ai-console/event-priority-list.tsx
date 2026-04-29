"use client";

import type { PriorityEvent } from "@/lib/ai-console/heuristic-engine";
import { cn } from "@/lib/utils";

const rankStyle: Record<number, string> = {
  1: "text-red-300 border-red-500/30",
  2: "text-orange-200 border-orange-500/25",
  3: "text-amber-200 border-amber-500/20",
  4: "text-zinc-200 border-white/10",
  5: "text-zinc-400 border-white/5",
};

export function EventPriorityList({ items }: { items: PriorityEvent[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#080818]/90 p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-violet-300/80">Priorização de eventos</p>
      <ul className="mt-3 space-y-2">
        {items.map((it, i) => (
          <li
            key={`${it.title}-${i}`}
            className={cn("rounded-lg border px-3 py-2 text-xs", rankStyle[it.rank] ?? "border-white/10")}
          >
            <span className="font-mono text-[10px] opacity-70">P{it.rank}</span> · <strong>{it.title}</strong>
            <p className="mt-0.5 text-[11px] text-zinc-400">{it.detail}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
