"use client";

import type { AuditClassified } from "@/lib/aog/disciplina-logic";

export function AuditAutoScanner({ items }: { items: AuditClassified[] }) {
  const top = [...items].sort((a, b) => b.priority - a.priority).slice(0, 24);
  return (
    <div className="rounded-2xl border border-slate-600/40 bg-[#070710] p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-slate-400">Auditoria autônoma · classificação</p>
      <div className="mt-4 max-h-72 overflow-auto">
        <table className="w-full text-left text-[11px]">
          <thead className="sticky top-0 bg-[#070710] text-[10px] uppercase text-zinc-500">
            <tr>
              <th className="py-1 pr-2">P</th>
              <th className="py-1 pr-2">Bucket</th>
              <th className="py-1">Resumo</th>
            </tr>
          </thead>
          <tbody>
            {top.map((r) => (
              <tr key={r.id} className="border-t border-white/5 text-zinc-300">
                <td className="py-1.5 pr-2 font-mono text-amber-200/80">{r.priority}</td>
                <td className="py-1.5 pr-2 capitalize text-zinc-500">{r.bucket}</td>
                <td className="py-1.5 text-zinc-400">{r.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
