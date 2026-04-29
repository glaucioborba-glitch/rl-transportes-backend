"use client";

import { cn } from "@/lib/utils";

export function QuadraCard({
  codigo,
  ocupacao,
  cap,
  onOpen,
}: {
  codigo: string;
  ocupacao: number;
  cap: number;
  onOpen: () => void;
}) {
  const pct = cap > 0 ? Math.min(100, Math.round((ocupacao / cap) * 100)) : 0;
  const tone =
    pct >= 80
      ? "border-red-500/50 bg-red-500/10"
      : pct >= 60
        ? "border-amber-500/50 bg-amber-500/10"
        : "border-emerald-500/40 bg-emerald-500/5";
  const bar = pct >= 80 ? "bg-red-500" : pct >= 60 ? "bg-amber-400" : "bg-emerald-500";

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex min-h-[120px] w-full flex-col rounded-2xl border-2 p-4 text-left transition-transform active:scale-[0.99]",
        tone,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-lg font-bold text-white">{codigo}</span>
        <span className="tabular-nums text-sm text-slate-400">
          {ocupacao}/{cap}
        </span>
      </div>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-black/40">
        <div className={cn("h-full transition-all", bar)} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-xs text-slate-500">Toque para listar unidades</p>
    </button>
  );
}
