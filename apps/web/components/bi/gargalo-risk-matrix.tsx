"use client";

import { cn } from "@/lib/utils";

type Row = {
  horas: number;
  p: number;
  g: number;
  pat: number;
  sai: number;
};

function cellTone(v: number) {
  const pct = v * 100;
  if (pct < 20) return "bg-emerald-500/35 text-emerald-100";
  if (pct <= 60) return "bg-amber-500/35 text-amber-100";
  return "bg-red-500/40 text-red-100";
}

export function GargaloRiskMatrix({ rows }: { rows: Row[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[520px] w-full border-collapse text-center text-xs">
        <thead>
          <tr className="border-b border-white/10 text-zinc-500">
            <th className="py-2 text-left">Horizonte</th>
            <th className="py-2">Portaria</th>
            <th className="py-2">Gate</th>
            <th className="py-2">Pátio</th>
            <th className="py-2">Saída</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.horas} className="border-b border-white/5">
              <td className="py-2 text-left font-mono text-zinc-300">{r.horas}h</td>
              <td className={cn("py-2 font-semibold", cellTone(r.p))}>{(r.p * 100).toFixed(0)}%</td>
              <td className={cn("py-2 font-semibold", cellTone(r.g))}>{(r.g * 100).toFixed(0)}%</td>
              <td className={cn("py-2 font-semibold", cellTone(r.pat))}>{(r.pat * 100).toFixed(0)}%</td>
              <td className={cn("py-2 font-semibold", cellTone(r.sai))}>{(r.sai * 100).toFixed(0)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
