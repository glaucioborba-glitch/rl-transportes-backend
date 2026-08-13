"use client";

import { cn } from "@/lib/utils";
import { buildContainerPrimaryDisplay } from "@/lib/container-display";
import { ContainerPrimaryHeading, ProtocolRefLabel } from "@/components/shared/operation-identity";

export function FilaCard({
  containerIsos,
  protocolo,
  statusLabel,
  subtitle,
  highlight,
  children,
}: {
  containerIsos: string[];
  protocolo?: string | null;
  statusLabel: string;
  subtitle?: string;
  highlight?: boolean;
  children?: React.ReactNode;
}) {
  const display = buildContainerPrimaryDisplay(containerIsos);

  return (
    <div
      className={cn(
        "rounded-2xl border-2 p-4",
        highlight
          ? "border-[var(--accent)] bg-[var(--accent)]/10 shadow-[0_0_24px_rgba(34,197,94,0.15)]"
          : "border-white/12 bg-black/35",
      )}
    >
      {protocolo ? <ProtocolRefLabel protocolo={protocolo} className="mb-1" /> : null}
      <ContainerPrimaryHeading display={display} size="lg" />
      <p className="mt-2 text-base font-semibold text-[var(--accent)]">{statusLabel}</p>
      {subtitle ? <p className="mt-2 text-sm text-slate-400">{subtitle}</p> : null}
      {children}
    </div>
  );
}
