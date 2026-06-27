"use client";

import { cn } from "@/lib/utils";

export type GiroEstimado = "RAPIDO" | "MEDIO" | "LENTO";

const GIRO_META: Record<
  GiroEstimado,
  { icon: string; label: string; className: string }
> = {
  RAPIDO: {
    icon: "⚡",
    label: "Giro rápido — priorizar perto do gate",
    className: "border-amber-400/50 bg-amber-500/15 text-amber-100",
  },
  MEDIO: {
    icon: "⏱",
    label: "Giro médio — posição intermediária",
    className: "border-sky-400/40 bg-sky-500/10 text-sky-100",
  },
  LENTO: {
    icon: "▾",
    label: "Giro lento — fundo do bloco",
    className: "border-zinc-500/40 bg-zinc-500/10 text-zinc-300",
  },
};

export function GiroEstimadoBadge({
  giro,
  className,
  showLabel = false,
}: {
  giro?: GiroEstimado | null;
  className?: string;
  showLabel?: boolean;
}) {
  if (!giro) return null;
  const meta = GIRO_META[giro];
  return (
    <span
      title={meta.label}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        meta.className,
        className,
      )}
    >
      <span aria-hidden>{meta.icon}</span>
      {showLabel ? <span>{giro === "RAPIDO" ? "Rápido" : giro === "MEDIO" ? "Médio" : "Lento"}</span> : null}
    </span>
  );
}
