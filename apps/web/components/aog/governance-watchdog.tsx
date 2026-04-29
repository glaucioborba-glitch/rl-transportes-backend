"use client";

import { cn } from "@/lib/utils";
import type { WatchdogLevel } from "@/lib/aog/core-logic";

const STYLES: Record<WatchdogLevel, string> = {
  normal: "border-slate-500/40 bg-slate-500/10 text-slate-200",
  atencao: "border-amber-500/50 bg-amber-950/40 text-amber-100",
  grave: "border-orange-600/50 bg-orange-950/35 text-orange-100",
  critico: "border-red-600/60 bg-red-950/45 text-red-100",
};

const LABEL: Record<WatchdogLevel, string> = {
  normal: "Normal",
  atencao: "Atenção",
  grave: "Grave",
  critico: "Crítico",
};

export function GovernanceWatchdog({ level, signals }: { level: WatchdogLevel; signals: string[] }) {
  return (
    <div className="rounded-2xl border border-slate-700/60 bg-[#070b12] p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-slate-400">Governance watchdog · 24/7</p>
      <div className="mt-4 flex flex-wrap items-start gap-4">
        <div className={cn("rounded-xl border-2 px-6 py-3 font-mono text-xl font-semibold", STYLES[level])}>
          {LABEL[level]}
        </div>
        <ul className="min-w-[240px] flex-1 space-y-1.5 text-xs text-zinc-300">
          {signals.map((s, i) => (
            <li key={i} className="flex gap-2 border-l-2 border-slate-600 pl-2">
              <span className="text-slate-500">▹</span>
              {s}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
