"use client";

import { cn } from "@/lib/utils";

const MAP: Record<string, { label: string; className: string }> = {
  pendente: { label: "Pendente", className: "bg-amber-500/20 text-amber-200 border-amber-500/40" },
  pago: { label: "Pago", className: "bg-emerald-500/20 text-emerald-200 border-emerald-500/40" },
  vencido: { label: "Vencido", className: "bg-red-500/20 text-red-200 border-red-500/40" },
  cancelado: { label: "Cancelado", className: "bg-slate-500/20 text-slate-300 border-slate-500/40" },
  aprovado: { label: "Aprovado", className: "bg-sky-500/20 text-sky-200 border-sky-500/40" },
  revisao: { label: "Em revisão", className: "bg-violet-500/20 text-violet-200 border-violet-500/40" },
  criado: { label: "Criado", className: "bg-slate-600/30 text-slate-200 border-slate-500/30" },
};

export function FinanceStatusBadge({ status }: { status: string }) {
  const k = status.toLowerCase();
  const cfg = MAP[k] ?? { label: status || "—", className: "bg-white/10 text-slate-300 border-white/20" };
  return (
    <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold", cfg.className)}>
      {cfg.label}
    </span>
  );
}
