"use client";

import type { EmergedPolicy } from "@/lib/agi/self-learning-logic";

export function PolicyEmergenceBoard({ policies }: { policies: EmergedPolicy[] }) {
  return (
    <div className="rounded-2xl border border-amber-500/30 bg-[#100808] p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-amber-200/80">Policy emergence · comportamento emergente</p>
      <ul className="mt-4 space-y-3">
        {policies.map((p) => (
          <li key={p.id} className="rounded-xl border border-white/10 bg-black/40 px-3 py-2">
            <p className="text-sm text-amber-50/95">{p.rule}</p>
            <p className="mt-1 text-[10px] text-zinc-500">Base: {p.basis}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
