"use client";

import { useEffect, useState } from "react";
import type { ImprovementPhase } from "@/lib/agi/self-optimizing-logic";
import { IMPROVEMENT_ORDER } from "@/lib/agi/self-optimizing-logic";
import { cn } from "@/lib/utils";

const LABEL: Record<ImprovementPhase, string> = {
  analisar: "Analisar",
  simular: "Simular",
  validar: "Validar eficiência",
};

export function AutoImprovementCycle({ active }: { active: boolean }) {
  const [i, setI] = useState(0);
  const [hist, setHist] = useState<number[]>([]);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => {
      setI((x) => {
        const n = (x + 1) % IMPROVEMENT_ORDER.length;
        if (n === 0) {
          setHist((h) => [72 + Math.round(Math.random() * 12), ...h].slice(0, 6));
        }
        return n;
      });
    }, 2800);
    return () => clearInterval(t);
  }, [active]);

  return (
    <div className="rounded-2xl border border-emerald-500/25 bg-[#040a08] p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-emerald-300/85">Auto‑improvement cycle</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {IMPROVEMENT_ORDER.map((step, idx) => (
          <div
            key={step}
            className={cn(
              "rounded-lg px-4 py-2 font-mono text-[11px] transition-all duration-500",
              active && idx === i
                ? "bg-emerald-600/30 text-emerald-100 ring-1 ring-emerald-400/40"
                : "bg-black/40 text-zinc-600",
            )}
          >
            {idx + 1}. {LABEL[step]}
          </div>
        ))}
      </div>
      {hist.length > 0 ? (
        <p className="mt-3 text-[10px] text-zinc-500">
          Eficácia histórica simulada:{" "}
          <span className="font-mono text-emerald-400/90">{hist.map((x) => `${x}%`).join(" · ")}</span>
        </p>
      ) : null}
    </div>
  );
}
