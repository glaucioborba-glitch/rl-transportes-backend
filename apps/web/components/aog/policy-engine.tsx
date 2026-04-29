"use client";

import { useState, useMemo } from "react";
import { AOG_POLICY_LIBRARY, evaluatePolicies, type PolicyDef } from "@/lib/aog/regulation-logic";
import type { OperationalSnapshot } from "@/lib/ai-console/operational-snapshot";
import type { IaGargaloBlob } from "@/lib/ai-console/operational-snapshot";
import { cn } from "@/lib/utils";

function policyDefaults(): Record<string, boolean> {
  return Object.fromEntries(AOG_POLICY_LIBRARY.map((p) => [p.id, p.defaultOn])) as Record<string, boolean>;
}

export function PolicyEngine(props: {
  snap: OperationalSnapshot;
  gar: IaGargaloBlob;
  iaProb: number;
  satPct: number;
}) {
  const [enabled, setEnabled] = useState<Record<string, boolean>>(policyDefaults);

  const results = useMemo(
    () =>
      evaluatePolicies(enabled, {
        satPct: props.satPct,
        iaProb: props.iaProb,
        snap: props.snap,
        gar: props.gar,
      }),
    [enabled, props.satPct, props.iaProb, props.snap, props.gar],
  );

  return (
    <div className="rounded-2xl border border-slate-600/50 bg-[#080810] p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-slate-400">Policy engine · front-only</p>
      <div className="mt-4 space-y-3">
        {AOG_POLICY_LIBRARY.map((p: PolicyDef) => {
          const on = enabled[p.id] !== false;
          const st = on ? (results.find((r) => r.id === p.id)?.status ?? "pass") : "off";
          return (
            <div key={p.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-white/10 bg-black/30 p-3">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={(e) => setEnabled((s) => ({ ...s, [p.id]: e.target.checked }))}
                  className="h-4 w-4 rounded border-zinc-600"
                />
                <div>
                  <p className="text-sm font-medium text-white">{p.title}</p>
                  <p className="text-[11px] text-zinc-500">{p.description}</p>
                </div>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded px-2 py-1 font-mono text-[10px]",
                  st === "off"
                    ? "bg-zinc-700/40 text-zinc-400"
                    : st === "trip"
                      ? "bg-red-500/20 text-red-200"
                      : st === "warn"
                        ? "bg-amber-500/20 text-amber-200"
                        : "bg-emerald-500/15 text-emerald-200",
                )}
              >
                {st === "off" ? "OFF" : st.toUpperCase()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
