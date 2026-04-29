"use client";

import type { ContainmentAction } from "@/lib/agi/self-correcting-logic";
import { cn } from "@/lib/utils";

export function ContainmentSimulator({ actions }: { actions: ContainmentAction[] }) {
  return (
    <div className="rounded-2xl border border-orange-500/35 bg-[#0c0806] p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-orange-300/85">Auto‑containment · firewall operacional</p>
      <ul className="mt-4 space-y-2">
        {actions.map((a) => (
          <li
            key={a.id}
            className={cn(
              "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs",
              a.active
                ? "border-orange-500/50 bg-orange-950/30 text-orange-100 shadow-[0_0_16px_rgba(234,88,12,0.15)]"
                : "border-white/5 text-zinc-600",
            )}
          >
            <span>{a.label}</span>
            <span className="font-mono text-[10px]">{a.active ? "ARMADO" : "standby"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
