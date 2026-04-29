"use client";

import type { ReputationBreakdown } from "@/lib/grc/executive-kpis";
import { cn } from "@/lib/utils";

export function ReputationScoreCard({ rep }: { rep: ReputationBreakdown }) {
  const { score } = rep;
  const band = score >= 72 ? "ok" : score >= 55 ? "warn" : "crit";

  return (
    <div
      className={cn(
        "grid gap-6 rounded-2xl border p-6 lg:grid-cols-12",
        band === "ok" && "border-emerald-500/25 bg-gradient-to-br from-emerald-950/20 to-[#05060c]",
        band === "warn" && "border-amber-500/25 bg-gradient-to-br from-amber-950/15 to-[#05060c]",
        band === "crit" && "border-red-500/25 bg-gradient-to-br from-red-950/20 to-[#05060c]",
      )}
    >
      <div className="lg:col-span-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-500">Risco reputacional</p>
        <p className="mt-3 font-mono text-6xl font-extralight tabular-nums text-white">{score}</p>
        <p className="mt-2 text-sm text-zinc-400">Score sintético 0–100 (100 = melhor) · exclusivamente heurísticas locais.</p>
        <p className="mt-4 text-[10px] uppercase text-zinc-600">Reincidência · crédito · SLA · margem</p>
      </div>
      <div className="lg:col-span-5 space-y-2">
        <p className="text-[10px] font-bold uppercase text-zinc-500">Drivers</p>
        <ul className="space-y-2">
          {rep.drivers.map((d) => (
            <li key={d.label} className="flex items-start justify-between gap-3 rounded-lg border border-white/5 bg-black/25 px-3 py-2">
              <div>
                <p className="text-xs text-zinc-200">{d.label}</p>
                <p className="text-[10px] text-zinc-600">{d.hint}</p>
              </div>
              <span className={cn("shrink-0 font-mono text-sm", d.delta < 0 ? "text-rose-300" : d.delta > 0 ? "text-emerald-300" : "text-zinc-500")}>
                {d.delta > 0 ? `+${d.delta}` : d.delta}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="lg:col-span-3">
        <p className="text-[10px] font-bold uppercase text-violet-300/90">Sugestões</p>
        <ul className="mt-3 space-y-3 text-xs leading-relaxed text-zinc-400">
          {rep.suggestions.map((s, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-violet-400">▸</span>
              <span>{s}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
