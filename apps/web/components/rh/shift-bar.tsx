"use client";

import { cn } from "@/lib/utils";

type Segment = { start: number; end: number; label: string; tone: "ok" | "warn" | "crit" };

const TONE: Record<Segment["tone"], string> = {
  ok: "bg-cyan-500/70",
  warn: "bg-amber-400/70",
  crit: "bg-red-500/70",
};

/** Barra 0–24h com segmentos proporcionais. */
export function ShiftBar({ segments }: { segments: Segment[] }) {
  return (
    <div>
      <div className="relative h-8 w-full overflow-hidden rounded-lg bg-zinc-800">
        {segments.map((s, i) => {
          const left = (s.start / 24) * 100;
          const w = ((s.end - s.start) / 24) * 100;
          return (
            <div
              key={i}
              title={`${s.label} (${s.start}h–${s.end}h)`}
              className={cn("absolute top-0 h-full", TONE[s.tone])}
              style={{ left: `${left}%`, width: `${w}%` }}
            />
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-zinc-500">
        <span>0h</span>
        <span>12h</span>
        <span>24h</span>
      </div>
    </div>
  );
}
