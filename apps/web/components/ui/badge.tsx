import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide transition-colors",
  {
    variants: {
      variant: {
        pendente: "border-amber-500/40 bg-amber-500/15 text-amber-200",
        aprovado: "border-emerald-500/40 bg-emerald-500/15 text-emerald-200",
        rejeitado: "border-red-500/40 bg-red-500/15 text-red-200",
        concluido: "border-sky-500/40 bg-sky-500/15 text-sky-200",
        /** @deprecated use concluido — mantido para compat. */
        processamento: "border-sky-500/40 bg-sky-500/15 text-sky-200",
        neutral: "border-white/15 bg-white/5 text-slate-300",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
