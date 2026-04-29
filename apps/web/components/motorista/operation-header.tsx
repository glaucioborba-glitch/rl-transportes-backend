"use client";

import { Package } from "lucide-react";

export function OperationHeader({
  cliente,
  isos,
  tipo,
  status,
}: {
  cliente?: string | null;
  isos: string[];
  tipo?: string | null;
  status?: string | null;
}) {
  return (
    <div className="rounded-2xl border border-white/12 bg-black/40 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10">
          <Package className="h-7 w-7 text-[var(--accent)]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide text-slate-500">Operação</p>
          <p className="truncate text-lg font-bold text-white">{cliente ?? "—"}</p>
          <p className="mt-1 font-mono text-sm text-emerald-300">{isos.length ? isos.join(" · ") : "—"}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {tipo ? (
              <span className="rounded-full bg-white/10 px-3 py-1 text-slate-200">{tipo}</span>
            ) : null}
            {status ? (
              <span className="rounded-full bg-[var(--accent)]/20 px-3 py-1 font-semibold text-[var(--accent)]">
                {status}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
