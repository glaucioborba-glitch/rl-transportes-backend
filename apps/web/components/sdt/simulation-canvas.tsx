"use client";

import { useEffect, useState } from "react";

export function SimulationCanvas({ satPct, active }: { satPct: number; active: boolean }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick((t) => t + 1), 400);
    return () => clearInterval(id);
  }, [active]);

  const trucks = [0, 1, 2];
  const pos = (i: number) => (((tick * (0.4 + i * 0.07) + i * 22) % 100) + 5) % 100;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#020805] p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-400/70">Operational flow simulator</p>
      <div className="relative mt-4 h-36 rounded-xl bg-gradient-to-b from-[#0a1810] to-black">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            background: `linear-gradient(to top, rgba(16,185,129,0.35) 0%, transparent ${Math.min(100, satPct)}%)`,
          }}
        />
        <div className="absolute inset-x-4 top-1/2 h-0.5 -translate-y-1/2 bg-gradient-to-r from-emerald-900 via-emerald-600/50 to-emerald-900" />
        <span className="absolute left-3 top-2 text-[9px] text-zinc-500">Entrada</span>
        <span className="absolute left-1/2 top-2 -translate-x-1/2 text-[9px] text-zinc-500">Gate</span>
        <span className="absolute right-3 top-2 text-[9px] text-zinc-500">Saída</span>
        {trucks.map((i) => (
          <div
            key={i}
            className="absolute top-1/2 h-6 w-10 -translate-y-1/2 rounded border border-emerald-400/50 bg-emerald-500/70 shadow-[0_0_12px_rgba(52,211,153,0.4)] transition-all duration-300"
            style={{ left: `${pos(i)}%`, marginLeft: "-20px" }}
          />
        ))}
      </div>
      <p className="mt-2 font-mono text-[10px] text-zinc-500">Saturação overlay · {satPct.toFixed(1)}% {active ? "" : "(pausado)"}</p>
    </div>
  );
}
