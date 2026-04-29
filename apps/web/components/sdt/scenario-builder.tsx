"use client";

import type { ScenarioProfile } from "@/lib/sdt/director-heuristics";
import { SDT_ABC_SCENARIOS } from "@/lib/sdt/director-heuristics";

export function ScenarioBuilder({
  loading,
  onRun,
}: {
  loading: boolean;
  onRun: (p: ScenarioProfile) => void;
}) {
  return (
    <div className="rounded-2xl border border-indigo-500/25 bg-[#080c18] p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-indigo-300/90">Scenario builder · A / B / C</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {SDT_ABC_SCENARIOS.map((p) => (
          <button
            key={p.label}
            type="button"
            disabled={loading}
            onClick={() => onRun(p)}
            className="rounded-xl border border-indigo-500/30 bg-indigo-950/30 p-4 text-left text-sm text-zinc-200 transition hover:bg-indigo-900/20 disabled:opacity-50"
          >
            <p className="font-semibold text-white">{p.label}</p>
            <p className="mt-1 font-mono text-[10px] text-zinc-500">
              Δ demanda +{p.demanda}% · quadra +{p.expansao} · turno +{p.turnoExtra}h
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
