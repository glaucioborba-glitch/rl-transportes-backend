"use client";

import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export function EtaBadge({ minutes, label }: { minutes: number | null; label?: string }) {
  const m = minutes == null || Number.isNaN(minutes) ? null : Math.max(0, Math.round(minutes));

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold",
        m === 0
          ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-200"
          : "border-white/15 bg-white/5 text-slate-200",
      )}
    >
      <Clock className="h-5 w-5 shrink-0" />
      <div>
        <p>{label ?? "Tempo estimado (referência)"}</p>
        <p className="text-lg text-white">{m === null ? "—" : m === 0 ? "Imediato" : `~${m} min`}</p>
      </div>
    </div>
  );
}
