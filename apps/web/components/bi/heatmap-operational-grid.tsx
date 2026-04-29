"use client";

import { cn } from "@/lib/utils";

/** grid[h][d] valores normalizados 0–1 */
export function HeatmapOperationalGrid({ grid, dayLabels }: { grid: number[][]; dayLabels: string[] }) {
  const flat = grid.flat();
  const mx = Math.max(...flat, 1e-6);
  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-[640px]">
        <div className="mb-1 grid" style={{ gridTemplateColumns: `48px repeat(${dayLabels.length}, minmax(0,1fr))` }}>
          <span />
          {dayLabels.map((d) => (
            <span key={d} className="text-center text-[10px] font-semibold text-zinc-500">
              {d}
            </span>
          ))}
        </div>
        {grid.map((row, hi) => (
          <div
            key={hi}
            className="grid items-stretch gap-px py-px"
            style={{ gridTemplateColumns: `48px repeat(${dayLabels.length}, minmax(0,1fr))` }}
          >
            <span className="pr-2 text-right text-[10px] text-zinc-500">{hi}h</span>
            {row.map((v, di) => {
              const n = v / mx;
              return (
                <div
                  key={di}
                  title={`${hi}h ${dayLabels[di]} · ${(n * 100).toFixed(0)}%`}
                  className={cn(
                    "h-5 rounded-sm",
                    n < 0.33 && "bg-sky-900/50",
                    n >= 0.33 && n < 0.66 && "bg-cyan-600/50",
                    n >= 0.66 && "bg-cyan-300/70",
                  )}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
