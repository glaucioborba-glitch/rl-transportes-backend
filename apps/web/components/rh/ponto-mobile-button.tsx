"use client";

import { cn } from "@/lib/utils";

type Estado = "closed" | "open" | "break";

export function PontoMobileButton({
  label,
  variant,
  disabled,
  onClick,
}: {
  label: string;
  variant: "primary" | "secondary" | "danger";
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex min-h-[52px] w-full items-center justify-center rounded-2xl text-sm font-bold uppercase tracking-wide transition active:scale-[0.98]",
        variant === "primary" && "bg-gradient-to-r from-cyan-500 to-sky-600 text-zinc-950",
        variant === "secondary" && "border border-cyan-500/40 bg-zinc-900 text-cyan-100",
        variant === "danger" && "border border-red-500/50 bg-red-500/15 text-red-100",
        disabled && "pointer-events-none opacity-40",
      )}
    >
      {label}
    </button>
  );
}

export type { Estado };
