"use client";

import { cn } from "@/lib/utils";
import type { FatigueLevel } from "@/lib/rh/fatigue";

export function FatigueGauge({ score, level }: { score: number; level: FatigueLevel }) {
  const color =
    level === "baixa" ? "from-emerald-400 to-cyan-400" : level === "moderada" ? "from-amber-400 to-amber-600" : "from-red-500 to-red-700";
  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Fatigue index</p>
          <p className={cn("text-2xl font-bold tabular-nums", level === "alta" && "text-red-300")}>{score}</p>
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-1 text-[10px] font-bold uppercase ring-1",
            level === "baixa" && "bg-emerald-500/15 text-emerald-200 ring-emerald-500/30",
            level === "moderada" && "bg-amber-500/15 text-amber-100 ring-amber-400/30",
            level === "alta" && "bg-red-500/20 text-red-100 ring-red-500/40",
          )}
        >
          {level}
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-800">
        <div
          className={cn("h-full rounded-full bg-gradient-to-r transition-all", color)}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}
