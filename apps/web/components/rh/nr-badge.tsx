import { cn } from "@/lib/utils";
import type { RhNrStatus } from "@/lib/rh/types";

const MAP: Record<RhNrStatus, string> = {
  válido: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40",
  vencido: "bg-red-500/20 text-red-200 ring-red-500/50",
  "exige reciclagem": "bg-amber-500/20 text-amber-100 ring-amber-400/40",
};

export function NrBadge({ status, className }: { status: RhNrStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1",
        MAP[status],
        className,
      )}
    >
      {status}
    </span>
  );
}
