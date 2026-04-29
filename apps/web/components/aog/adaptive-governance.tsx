"use client";

import type { AdaptiveRule } from "@/lib/aog/regulation-logic";

export function AdaptiveGovernance({ rules }: { rules: AdaptiveRule[] }) {
  return (
    <div className="rounded-2xl border border-teal-800/35 bg-[#051010] p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-teal-300/90">Governança adaptativa</p>
      <ul className="mt-4 space-y-2">
        {rules.map((r) => (
          <li
            key={r.id}
            className={`rounded-lg border px-3 py-2 text-xs ${r.active ? "border-teal-500/30 bg-teal-950/20 text-zinc-200" : "border-white/5 text-zinc-600"}`}
          >
            <p className="font-medium text-white">{r.condition}</p>
            <p className="mt-0.5 text-zinc-500">→ {r.action}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
