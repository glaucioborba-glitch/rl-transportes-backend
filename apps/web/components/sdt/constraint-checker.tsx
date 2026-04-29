"use client";

import { checkOperationalConstraints } from "@/lib/sdt/constraint-check";
import type { OperationalSnapshot } from "@/lib/ai-console/operational-snapshot";
import { cn } from "@/lib/utils";

export function ConstraintChecker({
  snap,
  iaProb,
  actionLabel,
}: {
  snap: OperationalSnapshot;
  iaProb: number;
  actionLabel: string;
}) {
  const r = checkOperationalConstraints(snap, iaProb, actionLabel);
  return (
    <div
      className={cn(
        "rounded-2xl border p-4 text-sm",
        r.allowed ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-100/90" : "border-red-500/40 bg-red-950/30 text-red-100",
      )}
    >
      <p className="text-[10px] font-bold uppercase tracking-widest">{r.allowed ? "Safety OK" : "Restrição"}</p>
      <p className="mt-2 text-xs">{r.reason}</p>
      <p className="mt-2 font-mono text-[10px] text-zinc-500">Ação: {actionLabel || "—"}</p>
    </div>
  );
}
