"use client";

import { Badge } from "@/components/ui/badge";

export type OcrCheckState = "pendente" | "sucesso" | "falhou";

export function OperadorStatusBadge({
  variant,
  children,
}: {
  variant: "pendente" | "sucesso" | "falhou" | "neutral";
  children: React.ReactNode;
}) {
  const cls =
    variant === "pendente"
      ? "border-amber-500/40 bg-amber-500/15 text-amber-100"
      : variant === "sucesso"
        ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-100"
        : variant === "falhou"
          ? "border-red-500/40 bg-red-500/15 text-red-100"
          : "border-white/15 bg-white/5 text-slate-300";
  return <Badge className={`font-normal normal-case ${cls}`}>{children}</Badge>;
}
