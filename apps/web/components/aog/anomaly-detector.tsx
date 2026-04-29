"use client";

import type { AnomalySignal } from "@/lib/aog/core-logic";
import { cn } from "@/lib/utils";

const SEV: Record<string, string> = {
  normal: "text-zinc-600",
  atencao: "text-amber-300",
  grave: "text-orange-300",
  critico: "text-red-300",
};

export function AnomalyDetector({ items }: { items: AnomalySignal[] }) {
  return (
    <div className="rounded-2xl border border-rose-900/40 bg-[#100810] p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-rose-300/90">Governance anomaly detector</p>
      <ul className="mt-4 space-y-2">
        {items.length === 0 ? (
          <li className="text-xs text-zinc-500">Nenhum padrão anômalo destacado no recorte atual.</li>
        ) : (
          items.map((a) => (
            <li key={a.id} className="rounded-lg border border-white/5 bg-black/30 px-3 py-2 text-xs">
              <span className={cn("font-mono text-[10px]", SEV[a.severity])}>{a.severity.toUpperCase()}</span>
              <p className="mt-0.5 font-medium text-white">{a.title}</p>
              <p className="text-zinc-500">{a.detail}</p>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
