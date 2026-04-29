"use client";

import { useEffect, useState } from "react";
import { EVOLUTION_ORDER, evolutionSemanticVersion, type EvolutionPhase } from "@/lib/agi/self-learning-logic";
import { cn } from "@/lib/utils";

const LABEL: Record<EvolutionPhase, string> = {
  observar: "Observar",
  comparar: "Comparar",
  aprender: "Aprender",
  ajustar: "Ajustar",
  registrar: "Registrar",
};

export function EvolutionLoop({ active }: { active: boolean }) {
  const [i, setI] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => {
      setI((x) => (x + 1) % EVOLUTION_ORDER.length);
      setTick((x) => x + 1);
    }, 2400);
    return () => clearInterval(t);
  }, [active]);

  const ver = evolutionSemanticVersion(tick);

  return (
    <div className="rounded-2xl border border-fuchsia-500/30 bg-[#080510] p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-fuchsia-300/80">Auto‑evolution loop</p>
        <div className="text-right">
          <p className="text-[10px] text-zinc-500">Versão interna simulada</p>
          <p className="font-mono text-lg text-fuchsia-200">{ver}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {EVOLUTION_ORDER.map((step, idx) => (
          <div
            key={step}
            className={cn(
              "rounded-lg px-3 py-2 font-mono text-[11px] transition-all duration-500",
              active && idx === i
                ? "scale-105 bg-fuchsia-600/25 text-fuchsia-100 ring-1 ring-fuchsia-400/50 shadow-[0_0_20px_rgba(217,70,239,0.2)]"
                : "bg-black/40 text-zinc-600",
            )}
          >
            {idx + 1}. {LABEL[step]}
          </div>
        ))}
      </div>
      <p className="mt-3 text-[10px] text-zinc-600">Laço: observar → comparar → aprender → ajustar → registrar · sem persistência backend.</p>
    </div>
  );
}
