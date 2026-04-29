"use client";

import type { SimulatedResponse } from "@/lib/aog/regulation-logic";

export function AutoRegulator({ items }: { items: SimulatedResponse[] }) {
  return (
    <div className="rounded-2xl border border-emerald-800/40 bg-[#040a08] p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-emerald-400/90">Auto-regulador operacional · simulado</p>
      <ul className="mt-4 space-y-3">
        {items.map((r) => (
          <li key={r.id} className="rounded-xl border border-emerald-900/30 bg-black/40 px-3 py-2">
            <p className="text-[10px] font-bold uppercase text-emerald-600/90">{r.trigger}</p>
            <p className="mt-1 text-sm text-zinc-200">{r.label}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
