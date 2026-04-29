"use client";

import { AlertTriangle, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

export function MobileAlert({
  variant,
  title,
  body,
}: {
  variant: "info" | "success" | "warn";
  title: string;
  body?: string;
}) {
  const Icon = variant === "warn" ? AlertTriangle : Bell;
  return (
    <div
      className={cn(
        "flex gap-3 rounded-2xl border-2 p-4",
        variant === "success" && "border-emerald-500/40 bg-emerald-950/40",
        variant === "info" && "border-sky-500/40 bg-sky-950/30",
        variant === "warn" && "border-amber-500/40 bg-amber-950/30",
      )}
    >
      <Icon
        className={cn(
          "h-7 w-7 shrink-0",
          variant === "success" && "text-emerald-400",
          variant === "info" && "text-sky-400",
          variant === "warn" && "text-amber-400",
        )}
      />
      <div>
        <p className="font-bold text-white">{title}</p>
        {body ? <p className="mt-1 text-sm text-slate-300">{body}</p> : null}
      </div>
    </div>
  );
}
