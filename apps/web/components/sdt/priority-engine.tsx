"use client";

import type { PriorityItem } from "@/lib/sdt/decision-engine-core";

export function PriorityEngine({ items }: { items: PriorityItem[] }) {
  return (
    <div className="rounded-2xl border border-cyan-500/20 bg-[#060f14] p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-300/80">APS · prioridade autônoma</p>
      <ul className="mt-4 space-y-3">
        {items.map((it, i) => (
          <li
            key={it.id}
            className="flex flex-col gap-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-3">
              <span className="font-mono text-lg text-emerald-400">#{i + 1}</span>
              <div>
                <p className="text-sm font-medium text-white">{it.action}</p>
                <p className="text-[11px] text-zinc-500">{it.rule}</p>
              </div>
            </div>
            <span className="shrink-0 font-mono text-xs text-amber-200/90">impacto {it.impact}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
