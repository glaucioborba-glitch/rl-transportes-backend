"use client";

import type { CostModelRow } from "@/lib/agi/self-optimizing-logic";

export function CostThroughputModel({ rows }: { rows: CostModelRow[] }) {
  return (
    <div className="rounded-2xl border border-slate-500/35 bg-[#070710] p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-slate-300">Cost‑to‑throughput model · front-only</p>
      <table className="mt-4 w-full text-left text-[11px]">
        <thead>
          <tr className="border-b border-white/10 text-[10px] uppercase text-zinc-500">
            <th className="py-2 pr-2">Métrica</th>
            <th className="py-2 pr-2">Unid.</th>
            <th className="py-2 pr-2">Valor</th>
            <th className="py-2">Efic.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-white/5 text-zinc-300">
              <td className="py-2 pr-2 text-white">{r.label}</td>
              <td className="py-2 pr-2 font-mono text-zinc-500">{r.unit}</td>
              <td className="py-2 pr-2 font-mono text-indigo-200">{r.value}</td>
              <td className="py-2 text-zinc-500">{r.eff}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
