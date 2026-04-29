"use client";

import type { CatalogRiskItem } from "@/lib/ssma/types";
import { cn } from "@/lib/utils";

export function RiskMatrix({ items }: { items: CatalogRiskItem[] }) {
  const byCell = new Map<string, CatalogRiskItem>();
  for (const it of items) {
    const pk = `${it.severidade}-${it.probabilidade}`;
    const prev = byCell.get(pk);
    if (!prev || it.score > prev.score) byCell.set(pk, it);
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <div className="inline-block min-w-[320px]">
          <p className="mb-1 text-center text-[10px] font-bold uppercase text-zinc-500">Probabilidade →</p>
          <div className="flex">
            <div className="flex w-8 flex-col justify-around py-0.5 pr-1 text-center text-[9px] text-zinc-600">
              <span>S5</span>
              <span>S4</span>
              <span>S3</span>
              <span>S2</span>
              <span>S1</span>
            </div>
            <div className="flex flex-1 flex-col gap-px">
              {[5, 4, 3, 2, 1].map((sev) => (
                <div key={sev} className="grid grid-cols-5 gap-px">
                  {[1, 2, 3, 4, 5].map((prob) => {
                    const score = prob * sev;
                    const it = byCell.get(`${sev}-${prob}`) ?? null;
                    return (
                      <div
                        key={`${sev}-${prob}`}
                        title={it?.titulo}
                        className={cn(
                          "flex h-12 flex-col items-center justify-center border border-white/5 text-[9px]",
                          score >= 16 && "bg-red-900/70 text-red-100",
                          score >= 9 && score < 16 && "bg-amber-800/60 text-amber-100",
                          score < 9 && "bg-emerald-900/40 text-emerald-100",
                        )}
                      >
                        <span className="font-mono font-bold">{score}</span>
                        {it ? <span className="text-amber-200">●</span> : null}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-1 flex justify-center gap-4 pl-8 text-[10px] text-zinc-600">
            <span>P1</span>
            <span>P2</span>
            <span>P3</span>
            <span>P4</span>
            <span>P5</span>
          </div>
        </div>
      </div>

      <div className="max-h-56 overflow-auto rounded-lg border border-white/10">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-zinc-950/95 text-zinc-500">
            <tr>
              <th className="p-2">Risco</th>
              <th className="p-2">P</th>
              <th className="p-2">S</th>
              <th className="p-2">Score</th>
              <th className="p-2">Fonte</th>
            </tr>
          </thead>
          <tbody>
            {items.slice(0, 18).map((r) => (
              <tr key={r.id} className="border-t border-white/5">
                <td className="p-2 text-zinc-300">{r.titulo}</td>
                <td className="p-2 font-mono">{r.probabilidade}</td>
                <td className="p-2 font-mono">{r.severidade}</td>
                <td className="p-2 font-mono text-amber-300">{r.score}</td>
                <td className="p-2 text-zinc-500">{r.fonte}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
