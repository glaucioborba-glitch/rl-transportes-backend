import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  className?: string;
  labelClassName?: string;
};

export function PatioGradeOrientacao({ children, className, labelClassName }: Props) {
  const label = cn(
    "flex w-7 shrink-0 items-center justify-center text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground",
    labelClassName,
  );
  return (
    <div className={cn("flex items-stretch gap-2", className)}>
      <span className={cn(label, "[writing-mode:vertical-rl] rotate-180")} aria-hidden>
        Fundos
      </span>
      <div className="min-w-0 flex-1">{children}</div>
      <span className={cn(label, "[writing-mode:vertical-rl]")} aria-hidden>
        Frente
      </span>
    </div>
  );
}
