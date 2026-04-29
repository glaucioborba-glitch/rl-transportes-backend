"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type TwinFlashEvent = {
  id: string;
  kind: "gate_in" | "patio" | "gate_out" | "spike" | "alert";
  label: string;
  xPct: number;
  yPct: number;
  until: number;
};

export function TwinEventLayer({ events }: { events: TwinFlashEvent[] }) {
  const [, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT((x) => x + 1), 200);
    return () => clearInterval(id);
  }, []);

  const now = Date.now();

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {events.map((e) => {
        const live = e.until > now;
        const pulse = live ? "animate-pulse" : "opacity-40";
        const color =
          e.kind === "alert"
            ? "bg-purple-500"
            : e.kind === "spike"
              ? "bg-amber-400"
              : e.kind === "gate_out"
                ? "bg-emerald-400"
                : e.kind === "patio"
                  ? "bg-cyan-400"
                  : "bg-sky-400";
        return (
          <div
            key={e.id}
            className={cn("absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center", pulse)}
            style={{ left: `${e.xPct}%`, top: `${e.yPct}%` }}
          >
            <span className={cn("h-3 w-3 rounded-full shadow-lg ring-2 ring-white/30", color)} />
            <span className="mt-1 max-w-[120px] rounded bg-black/70 px-1.5 py-0.5 text-center text-[8px] font-bold uppercase text-white">
              {e.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
