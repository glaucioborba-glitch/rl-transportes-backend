"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  buildContainerPrimaryDisplay,
  extraUnitsBadgeLabel,
  operationTitleFromIsos,
  type ContainerPrimaryDisplay,
} from "@/lib/container-display";
import { cn } from "@/lib/utils";

const PRIMARY_SIZE: Record<"sm" | "md" | "lg" | "xl", string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
  xl: "text-2xl",
};

export function ProtocolRefLabel({
  protocolo,
  className,
  prefix = "Ref:",
}: {
  protocolo?: string | null;
  className?: string;
  prefix?: string;
}) {
  if (!protocolo?.trim()) return null;
  return (
    <p className={cn("font-mono text-xs text-slate-500", className)}>
      {prefix} {protocolo.trim()}
    </p>
  );
}

export function ProtocolRefTag({
  protocolo,
  className,
}: {
  protocolo?: string | null;
  className?: string;
}) {
  if (!protocolo?.trim()) return null;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-xs normal-case text-slate-400",
        className,
      )}
    >
      Ref: {protocolo.trim()}
    </span>
  );
}

export function ContainerExtraUnitsBadge({
  extraCount,
  className,
}: {
  extraCount: number;
  className?: string;
}) {
  const label = extraUnitsBadgeLabel(extraCount);
  if (!label) return null;
  return (
    <Badge variant="neutral" className={cn("normal-case font-medium text-slate-300", className)}>
      {label}
    </Badge>
  );
}

export function ContainerPrimaryHeading({
  display,
  size = "md",
  className,
  onContainerClick,
}: {
  display: ContainerPrimaryDisplay;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  /** Abre dossiê / timeline do contêiner (portal). */
  onContainerClick?: (iso: string) => void;
}) {
  const primaryEl =
    onContainerClick && display.primary !== "—" ? (
      <button
        type="button"
        className={cn(
          "font-mono font-bold tracking-tight text-[var(--accent)] underline-offset-2 hover:underline",
          PRIMARY_SIZE[size],
        )}
        onClick={() => onContainerClick(display.primary)}
      >
        {display.primary}
      </button>
    ) : (
      <span
        className={cn(
          "font-mono font-bold tracking-tight text-[var(--accent)]",
          PRIMARY_SIZE[size],
        )}
      >
        {display.primary}
      </span>
    );

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {primaryEl}
      {display.extraCount > 0 ? <ContainerExtraUnitsBadge extraCount={display.extraCount} /> : null}
    </div>
  );
}

export function OperationCardIdentity({
  isos,
  protocolo,
  size = "md",
  protocolPosition = "above",
  className,
  children,
  onContainerClick,
}: {
  isos: string[];
  protocolo?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  protocolPosition?: "above" | "below";
  className?: string;
  children?: ReactNode;
  onContainerClick?: (iso: string) => void;
}) {
  const display = buildContainerPrimaryDisplay(isos);
  const ref = protocolo ? <ProtocolRefLabel protocolo={protocolo} /> : null;

  return (
    <div className={cn("min-w-0 space-y-1", className)}>
      {protocolPosition === "above" ? ref : null}
      <ContainerPrimaryHeading display={display} size={size} onContainerClick={onContainerClick} />
      {protocolPosition === "below" ? ref : null}
      {children}
    </div>
  );
}

export function OperationPageHeader({
  isos,
  protocolo,
  eyebrow,
  actions,
  verb = "Operação",
  className,
}: {
  isos: string[];
  protocolo?: string | null;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  verb?: string;
  className?: string;
}) {
  const display = buildContainerPrimaryDisplay(isos);
  const title = operationTitleFromIsos(isos, verb);

  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="min-w-0 flex-1">
        {eyebrow}
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-mono text-2xl font-bold tracking-tight text-[var(--accent)]">
            {title}
          </h1>
          {display.extraCount > 0 ? <ContainerExtraUnitsBadge extraCount={display.extraCount} /> : null}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        {protocolo ? <ProtocolRefTag protocolo={protocolo} /> : null}
        {actions}
      </div>
    </div>
  );
}

export function OperationDialogHeader({
  isos,
  protocolo,
  verb = "Operação",
  description,
}: {
  isos: string[];
  protocolo?: string | null;
  verb?: string;
  description?: ReactNode;
}) {
  const display = buildContainerPrimaryDisplay(isos);
  const title = operationTitleFromIsos(isos, verb);

  return (
    <DialogHeader className="gap-3 sm:text-left">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <DialogTitle className="flex flex-wrap items-center gap-2 text-left">
            <span>{title}</span>
            {display.extraCount > 0 ? <ContainerExtraUnitsBadge extraCount={display.extraCount} /> : null}
          </DialogTitle>
          {description}
        </div>
        {protocolo ? <ProtocolRefTag protocolo={protocolo} className="mt-0.5" /> : null}
      </div>
    </DialogHeader>
  );
}
