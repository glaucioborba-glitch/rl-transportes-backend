"use client";

import type { ConformityStatus } from "@/lib/aog/core-logic";
import { cn } from "@/lib/utils";

const BADGE: Record<ConformityStatus, string> = {
  OK: "bg-emerald-900/40 text-emerald-200 border-emerald-500/40",
  WARN: "bg-amber-950/50 text-amber-100 border-amber-500/40",
  FAIL: "bg-red-950/50 text-red-100 border-red-500/40",
};

export function ConformityEngine({
  overall,
  checks,
}: {
  overall: ConformityStatus;
  checks: { name: string; status: ConformityStatus; detail: string }[];
}) {
  return (
    <div className="rounded-2xl border border-slate-600/40 bg-[#080c14] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-slate-400">Conformity engine</p>
        <span className={cn("rounded-lg border px-3 py-1 font-mono text-sm font-bold", BADGE[overall])}>{overall}</span>
      </div>
      <table className="mt-4 w-full text-left text-xs">
        <thead>
          <tr className="border-b border-white/10 text-[10px] uppercase text-zinc-500">
            <th className="py-2 pr-2">Verificação</th>
            <th className="py-2 pr-2">Status</th>
            <th className="py-2">Detalhe</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((c) => (
            <tr key={c.name} className="border-b border-white/5 text-zinc-300">
              <td className="py-2 pr-2 font-medium text-white">{c.name}</td>
              <td className="py-2 pr-2">
                <span className={cn("rounded px-2 py-0.5 font-mono text-[10px]", BADGE[c.status])}>{c.status}</span>
              </td>
              <td className="py-2 text-zinc-500">{c.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
