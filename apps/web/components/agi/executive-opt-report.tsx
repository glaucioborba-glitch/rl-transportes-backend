"use client";

import type { ExecutiveOptReport } from "@/lib/agi/self-optimizing-logic";

export function ExecutiveOptReport({ report }: { report: ExecutiveOptReport }) {
  return (
    <div className="rounded-2xl border border-amber-500/35 bg-gradient-to-br from-[#121008] to-[#08060a] p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-amber-200/80">Executive optimization report</p>
      <p className="mt-4 text-base font-medium leading-relaxed text-amber-50/95">{report.headline}</p>
      <div className="mt-4 flex flex-wrap gap-4 border-t border-white/10 pt-4 text-sm">
        <div>
          <p className="text-[10px] uppercase text-zinc-500">Economia proxy</p>
          <p className="font-mono text-2xl text-emerald-400">~{report.savingsPct}%</p>
        </div>
        <div className="min-w-[200px] flex-1">
          <p className="text-[10px] uppercase text-zinc-500">Risco</p>
          <p className="text-zinc-300">{report.riskNote}</p>
        </div>
      </div>
    </div>
  );
}
