"use client";

import { cn } from "@/lib/utils";

const TURNOS = ["Manhã", "Tarde", "Noite"];
const NRS = ["NR-06", "NR-11", "NR-12", "NR-33", "NR-35"];

export function NrControlHeatmap({ cell }: { cell: (ti: number, ni: number) => number }) {
  const header = [<div key="h0" />, ...NRS.map((nr) => (
    <span key={nr} className="py-2 text-center text-[10px] font-mono text-amber-500/90">
      {nr}
    </span>
  ))];

  const body = TURNOS.flatMap((t, ti) => [
    <span key={`lab-${ti}`} className="flex items-center py-2 pl-2 text-[11px] text-zinc-400">
      {t}
    </span>,
    ...NRS.map((nr, ni) => {
      const v = cell(ti, ni);
      return (
        <div
          key={`${t}-${nr}`}
          title={`${t} · ${nr}: ${v}%`}
          className={cn(
            "flex h-11 items-center justify-center text-[11px] font-mono font-bold",
            v >= 85 && "bg-emerald-800/70 text-emerald-100",
            v >= 60 && v < 85 && "bg-amber-800/55 text-amber-50",
            v < 60 && "bg-red-900/65 text-red-100",
          )}
        >
          {v}
        </div>
      );
    }),
  ]);

  return (
    <div className="overflow-x-auto">
      <div
        className="inline-grid gap-px rounded-lg border border-white/10 p-2"
        style={{ gridTemplateColumns: `100px repeat(${NRS.length}, minmax(48px,1fr))` }}
      >
        {header}
        {body}
      </div>
    </div>
  );
}
