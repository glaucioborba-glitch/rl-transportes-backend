"use client";

import { cn } from "@/lib/utils";

export function FilaCard({
  protocolo,
  statusLabel,
  subtitle,
  highlight,
  children,
}: {
  protocolo: string;
  statusLabel: string;
  subtitle?: string;
  highlight?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border-2 p-4",
        highlight
          ? "border-[var(--accent)] bg-[var(--accent)]/10 shadow-[0_0_24px_rgba(34,197,94,0.15)]"
          : "border-white/12 bg-black/35",
      )}
    >
      <p className="font-mono text-lg font-bold text-white">{protocolo}</p>
      <p className="mt-1 text-base font-semibold text-[var(--accent)]">{statusLabel}</p>
      {subtitle ? <p className="mt-2 text-sm text-slate-400">{subtitle}</p> : null}
      {children}
    </div>
  );
}
