"use client";

import { cn } from "@/lib/utils";

/** Heatmap 24h × turnos fictícios (densidade 0–1). */
export function WorkloadHeatmap({ cells }: { cells: number[][] }) {
  const flatMax = Math.max(0.001, ...cells.flat());
  return (
    <div className="space-y-2">
      <div className="flex max-sm:overflow-x-auto flex-col gap-px">
        {cells.map((row, ri) => (
          <div
            key={ri}
            className="grid min-w-[480px] gap-px"
            style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}
          >
            {row.map((v, ci) => {
              const n = v / flatMax;
              return (
                <div
                  key={`${ri}-${ci}`}
                  title={`Linha ${ri + 1} · col ${ci + 1}: ${Math.round(n * 100)}%`}
                  className={cn(
                    "h-6 rounded-sm",
                    n < 0.33 && "bg-emerald-500/30",
                    n >= 0.33 && n < 0.66 && "bg-amber-400/40",
                    n >= 0.66 && "bg-red-500/45",
                  )}
                />
              );
            })}
          </div>
        ))}
      </div>
      <p className="text-[10px] text-zinc-500">
        Legenda: verde baixa carga · âmbar moderada · vermelho saturação estimada (somente modelo local).
      </p>
    </div>
  );
}
