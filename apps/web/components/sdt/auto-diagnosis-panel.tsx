"use client";

import type { DiagnosisLine } from "@/lib/sdt/decision-engine-core";
import { cn } from "@/lib/utils";

const KIND: Record<DiagnosisLine["kind"], string> = {
  cause: "text-amber-200/90 border-amber-500/20",
  risk: "text-red-200/90 border-red-500/25",
  opportunity: "text-emerald-200/90 border-emerald-500/25",
};

export function AutoDiagnosisPanel({ lines }: { lines: DiagnosisLine[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#080810] p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500">Auto-diagnosis</p>
      <ul className="mt-4 space-y-2">
        {lines.map((l, i) => (
          <li key={i} className={cn("rounded-lg border px-3 py-2 text-xs", KIND[l.kind])}>
            <span className="mr-2 font-mono text-[10px] uppercase opacity-70">{l.kind}</span>
            {l.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
