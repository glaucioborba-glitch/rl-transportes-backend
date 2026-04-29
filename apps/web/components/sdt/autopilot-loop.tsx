"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const OPTIONS: { ms: number | null; label: string }[] = [
  { ms: null, label: "Manual" },
  { ms: 30_000, label: "30s" },
  { ms: 60_000, label: "60s" },
  { ms: 120_000, label: "120s" },
];

export function AutopilotLoop({
  pollMs,
  onPollMsChange,
  onCycle,
  lastUpdated,
}: {
  pollMs: number | null;
  onPollMsChange: (ms: number | null) => void;
  onCycle: () => void;
  lastUpdated: number;
}) {
  const [step, setStep] = useState(0);
  const stages = ["Ler estado", "Decidir", "Projetar impacto", "Simular", "Reavaliar"];

  useEffect(() => {
    if (pollMs == null) return;
    const id = setInterval(() => {
      setStep((s) => (s + 1) % stages.length);
    }, Math.min(4000, Math.max(1500, pollMs / 8)));
    return () => clearInterval(id);
  }, [pollMs, stages.length]);

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-[#050f0a] p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-400/90">Autopilot loop</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {OPTIONS.map((o) => (
          <Button
            key={o.label}
            type="button"
            size="sm"
            variant={pollMs === o.ms ? "default" : "outline"}
            className={cn(
              pollMs === o.ms ? "bg-emerald-600 hover:bg-emerald-500" : "border-emerald-500/30 text-zinc-300",
            )}
            onClick={() => onPollMsChange(o.ms)}
          >
            {o.label}
          </Button>
        ))}
        <Button type="button" size="sm" variant="outline" className="border-emerald-500/40" onClick={onCycle}>
          Forçar ciclo
        </Button>
      </div>
      <p className="mt-3 font-mono text-[10px] text-zinc-500">
        Último sync: {new Date(lastUpdated).toLocaleTimeString("pt-BR")}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {stages.map((lab, i) => (
          <div
            key={lab}
            className={cn(
              "rounded-lg px-3 py-1.5 text-[11px] font-medium",
              i === step ? "bg-emerald-500/25 text-emerald-100 ring-1 ring-emerald-400/40" : "bg-black/30 text-zinc-500",
            )}
          >
            {i + 1}. {lab}
          </div>
        ))}
      </div>
    </div>
  );
}
