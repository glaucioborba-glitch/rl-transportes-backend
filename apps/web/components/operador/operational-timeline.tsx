"use client";

import { cn } from "@/lib/utils";

type Phase = "portaria" | "gate" | "patio" | "saida";

export function OperationalTimeline({
  active,
  portariaDone,
  gateDone,
  patioDone,
  saidaDone,
}: {
  active: Phase;
  portariaDone: boolean;
  gateDone: boolean;
  patioDone: boolean;
  saidaDone: boolean;
}) {
  const steps: { id: Phase; label: string; done: boolean }[] = [
    { id: "portaria", label: "Portaria", done: portariaDone },
    { id: "gate", label: "Gate", done: gateDone },
    { id: "patio", label: "Pátio", done: patioDone },
    { id: "saida", label: "Saída", done: saidaDone },
  ];

  return (
    <ol className="flex flex-wrap gap-2">
      {steps.map((s) => {
        const isActive = s.id === active;
        return (
          <li
            key={s.id}
            className={cn(
              "flex min-h-14 min-w-[7rem] flex-1 basis-[45%] flex-col justify-center rounded-xl border px-3 py-2 text-center sm:basis-0",
              s.done && "border-emerald-500/40 bg-emerald-500/10 text-emerald-100",
              !s.done && isActive && "border-[var(--accent)]/50 bg-[var(--accent)]/10 text-white",
              !s.done && !isActive && "border-white/10 bg-black/30 text-slate-500",
            )}
          >
            <span className="text-xs font-semibold uppercase tracking-wide">{s.label}</span>
            <span className="text-[10px] text-slate-400">
              {s.done ? "OK" : isActive ? "Ativo" : "—"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
