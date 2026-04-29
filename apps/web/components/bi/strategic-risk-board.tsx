"use client";

import { cn } from "@/lib/utils";

export function StrategicRiskBoard({
  tiles,
}: {
  tiles: { id: string; label: string; value: string; tone: "ok" | "warn" | "crit"; hint?: string }[];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {tiles.map((t) => (
        <div
          key={t.id}
          className={cn(
            "rounded-xl border p-4",
            t.tone === "ok" && "border-emerald-500/25 bg-emerald-950/20",
            t.tone === "warn" && "border-amber-500/25 bg-amber-950/15",
            t.tone === "crit" && "border-red-500/30 bg-red-950/20",
          )}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{t.label}</p>
          <p className="mt-2 text-xl font-bold text-white">{t.value}</p>
          {t.hint ? <p className="mt-1 text-[11px] text-zinc-500">{t.hint}</p> : null}
        </div>
      ))}
    </div>
  );
}
