"use client";

import { cn } from "@/lib/utils";

export type AlertItem = { id: string; level: "alta" | "media" | "baixa"; titulo: string; detalhe: string };

export function CriticalAlertsPanel({ alerts }: { alerts: AlertItem[] }) {
  return (
    <ul className="space-y-2">
      {alerts.map((a) => (
        <li
          key={a.id}
          className={cn(
            "rounded-xl border px-4 py-3 text-sm",
            a.level === "alta" && "border-red-500/40 bg-red-950/30 text-red-100",
            a.level === "media" && "border-amber-500/35 bg-amber-950/20 text-amber-100",
            a.level === "baixa" && "border-zinc-600 bg-zinc-950/50 text-zinc-300",
          )}
        >
          <p className="font-bold uppercase tracking-wide text-[10px] text-zinc-500">{a.level}</p>
          <p className="font-semibold">{a.titulo}</p>
          <p className="mt-1 text-xs text-zinc-400">{a.detalhe}</p>
        </li>
      ))}
    </ul>
  );
}
