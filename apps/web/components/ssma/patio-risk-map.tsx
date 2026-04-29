"use client";

import { patioCellRisk, riskToHeatLevel } from "@/lib/ssma/risk-catalog";
import { cn } from "@/lib/utils";

export function PatioRiskMap({
  rows,
  cols,
  ocupacaoPct,
  incidentsPatioCount,
  catalogMaxScore,
}: {
  rows: number;
  cols: number;
  ocupacaoPct: number;
  incidentsPatioCount: number;
  catalogMaxScore: number;
}) {
  const grid: { score: number; level: ReturnType<typeof riskToHeatLevel> }[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: typeof grid[number] = [];
    for (let c = 0; c < cols; c++) {
      const score = patioCellRisk(r, c, ocupacaoPct, incidentsPatioCount, catalogMaxScore);
      row.push({ score, level: riskToHeatLevel(score) });
    }
    grid.push(row);
  }

  return (
    <div className="space-y-3">
      <div
        className="inline-grid gap-1 p-2"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 2.5rem))` }}
      >
        {grid.flatMap((row, ri) =>
          row.map((cell, ci) => (
            <div
              key={`${ri}-${ci}`}
              title={`Quadra ${String.fromCharCode(65 + ri)}${ci + 1} · risco ${cell.score}`}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-md border text-[9px] font-mono font-bold",
                cell.level === "baixo" && "border-emerald-500/40 bg-emerald-900/35 text-emerald-100",
                cell.level === "moderado" && "border-amber-500/40 bg-amber-900/40 text-amber-100",
                cell.level === "critico" && "border-red-500/50 bg-red-900/45 text-red-100",
              )}
            >
              {cell.score}
            </div>
          ))
        )}
      </div>
      <div className="flex flex-wrap gap-4 text-[11px] text-zinc-500">
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-emerald-900/50 ring-1 ring-emerald-600" /> Baixo
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-amber-900/50 ring-1 ring-amber-500" /> Moderado
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-red-900/50 ring-1 ring-red-500" /> Crítico
        </span>
      </div>
    </div>
  );
}
