"use client";

import { cn } from "@/lib/utils";

export function CorporateRiskMatrix({
  cells,
}: {
  cells: { id: string; label: string; impacto: number; prob: number; nota?: string }[];
}) {
  return (
    <div className="relative aspect-[4/3] max-h-[360px] w-full rounded-xl border border-white/10 bg-zinc-950/60 p-4">
      <div className="absolute inset-8 grid grid-cols-3 grid-rows-3 gap-1 opacity-40">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="rounded border border-white/5" />
        ))}
      </div>
      <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-zinc-500">Probabilidade →</span>
      <span className="absolute left-2 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] text-zinc-500">Impacto →</span>
      {cells.map((c) => {
        const left = 12 + (c.prob / 100) * 76;
        const top = 88 - (c.impacto / 100) * 76;
        return (
          <div
            key={c.id}
            title={c.nota}
            className={cn(
              "absolute flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[10px] font-bold shadow-lg",
              c.impacto * c.prob > 2500 ? "bg-red-500/80 text-white" : c.impacto * c.prob > 1200 ? "bg-amber-500/80 text-zinc-900" : "bg-emerald-500/70 text-zinc-950",
            )}
            style={{ left: `${left}%`, top: `${top}%` }}
          >
            {c.label.slice(0, 3)}
          </div>
        );
      })}
    </div>
  );
}
