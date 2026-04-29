import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ExecutiveTile({
  label,
  value,
  sub,
  variant = "default",
  action,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  variant?: "default" | "danger" | "success";
  action?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-5 shadow-lg shadow-black/30",
        variant === "default" && "border-white/10 bg-[#0c121c]",
        variant === "danger" && "border-red-500/25 bg-red-950/20",
        variant === "success" && "border-emerald-500/20 bg-emerald-950/15",
      )}
    >
      <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">{label}</p>
      <div className="mt-2 text-2xl font-bold tabular-nums text-white">{value}</div>
      {sub ? <p className="mt-1 text-xs text-zinc-500">{sub}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
