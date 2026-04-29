"use client";

import { cn } from "@/lib/utils";

export function SsmaHeatLevels({
  operacional,
  processo,
  conformidade,
}: {
  operacional: number;
  processo: number;
  conformidade: number;
}) {
  const bars = [
    { label: "Exposição operacional", v: operacional, desc: "Carga × violações agregadas" },
    { label: "Disciplina de processo", v: processo, desc: "Inverso retrabalho / gargalo" },
    { label: "Conformidade NR / controles", v: conformidade, desc: "Heurística SSMA" },
  ];

  return (
    <div className="space-y-4">
      {bars.map((b) => (
        <div key={b.label}>
          <div className="mb-1 flex justify-between text-[11px]">
            <span className="font-semibold text-zinc-300">{b.label}</span>
            <span className="font-mono text-amber-300">{b.v}%</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                b.v >= 70 && "bg-gradient-to-r from-red-600 to-red-400",
                b.v >= 40 && b.v < 70 && "bg-gradient-to-r from-amber-700 to-amber-500",
                b.v < 40 && "bg-gradient-to-r from-emerald-800 to-emerald-500",
              )}
              style={{ width: `${Math.min(100, b.v)}%` }}
            />
          </div>
          <p className="mt-0.5 text-[10px] text-zinc-600">{b.desc}</p>
        </div>
      ))}
    </div>
  );
}
