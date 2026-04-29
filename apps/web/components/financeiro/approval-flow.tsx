"use client";

import { Check, Circle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export function ApprovalFlow({
  current,
}: {
  current: "criado" | "aprovado" | "pago";
}) {
  const steps: { key: typeof current; label: string }[] = [
    { key: "criado", label: "Criado" },
    { key: "aprovado", label: "Aprovado" },
    { key: "pago", label: "Pago" },
  ];
  const idx = steps.findIndex((s) => s.key === current);

  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">Fluxo de aprovação (visão tesouraria)</p>
      <ol className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-0">
        {steps.map((s, i) => {
          const done = i <= idx;
          const active = i === idx;
          return (
            <li key={s.key} className="flex flex-1 items-center gap-2">
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border-2",
                  done ? "border-emerald-500 bg-emerald-500/20 text-emerald-300" : "border-zinc-600 text-zinc-600",
                  active && "ring-2 ring-amber-500/50",
                )}
              >
                {done ? <Check className="h-4 w-4" /> : <Circle className="h-3 w-3" />}
              </div>
              <div className="min-w-0">
                <p className={cn("text-sm font-semibold", done ? "text-white" : "text-zinc-500")}>{s.label}</p>
                {active ? (
                  <p className="flex items-center gap-1 text-xs text-amber-400">
                    <Clock className="h-3 w-3" /> etapa atual
                  </p>
                ) : null}
              </div>
              {i < steps.length - 1 ? (
                <div className={cn("mx-1 hidden h-0.5 flex-1 sm:block", done ? "bg-emerald-500/40" : "bg-zinc-700")} />
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
