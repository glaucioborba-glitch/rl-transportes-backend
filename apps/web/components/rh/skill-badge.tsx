import { cn } from "@/lib/utils";
import type { RhCompetencyCell } from "@/lib/rh/types";

const STYLES: Record<RhCompetencyCell, string> = {
  ok: "bg-emerald-500/15 text-emerald-200",
  warn: "bg-amber-500/15 text-amber-100",
  bad: "bg-red-500/20 text-red-200",
};

const LABEL: Record<RhCompetencyCell, string> = {
  ok: "Apto",
  warn: "< 30d",
  bad: "Vencido",
};

export function SkillBadge({ cell, className }: { cell: RhCompetencyCell; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-[4.5rem] justify-center rounded-md px-2 py-1 text-[10px] font-semibold uppercase",
        STYLES[cell],
        className,
      )}
    >
      {LABEL[cell]}
    </span>
  );
}
