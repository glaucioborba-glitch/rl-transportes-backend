"use client";

import { useMemo } from "react";
import type { MatrixPlotPoint } from "@/lib/grc/types";
import { cn } from "@/lib/utils";

export function Iso31000RiskMatrix({ plots }: { plots: MatrixPlotPoint[] }) {
  const byCell = useMemo(() => {
    const m = new Map<string, MatrixPlotPoint[]>();
    for (const p of plots) {
      const k = `${p.i}-${p.p}`;
      const arr = m.get(k) ?? [];
      arr.push(p);
      m.set(k, arr);
    }
    return m;
  }, [plots]);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <div className="inline-block min-w-[340px]">
          <p className="mb-1 text-center text-[10px] font-bold uppercase text-zinc-500">Probabilidade →</p>
          <div className="flex">
            <div className="flex w-10 flex-col justify-around py-1 text-center text-[9px] text-zinc-600">
              <span>I5</span>
              <span>I4</span>
              <span>I3</span>
              <span>I2</span>
              <span>I1</span>
            </div>
            <div className="flex flex-1 flex-col gap-px">
              {[5, 4, 3, 2, 1].map((impact) => (
                <div key={impact} className="grid grid-cols-5 gap-px">
                  {[1, 2, 3, 4, 5].map((prob) => {
                    const score = prob * impact;
                    const list = byCell.get(`${impact}-${prob}`) ?? [];
                    const bg =
                      score >= 16
                        ? "bg-zinc-950 text-rose-200 ring-1 ring-red-700"
                        : score >= 10
                          ? "bg-red-950/55"
                          : score >= 4
                            ? "bg-amber-900/45"
                            : "bg-emerald-900/35";
                    return (
                      <div
                        key={`${impact}-${prob}`}
                        className={cn("flex h-14 flex-col items-center justify-center border border-white/5 text-[9px]", bg)}
                        title={`P${prob}×I${impact}=${score}`}
                      >
                        <span className="font-mono font-bold opacity-70">{score}</span>
                        {list.length ? (
                          <span className="mt-0.5 max-w-full truncate px-0.5 text-[8px] text-white/90" title={list.map((l) => l.label).join(", ")}>
                            {list.length}●
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-1 flex justify-center gap-6 pl-10 text-[10px] text-zinc-600">
            <span>P1</span>
            <span>P2</span>
            <span>P3</span>
            <span>P4</span>
            <span>P5</span>
          </div>
        </div>
      </div>
      <ul className="max-h-32 space-y-1 overflow-auto text-[10px] text-zinc-500">
        {plots.map((p) => (
          <li key={p.id}>
            <span className={cn("font-mono", p.source === "api" ? "text-amber-300" : "text-cyan-300")}>{p.source}</span>
            {" · "}
            {p.label}
            {` · P${p.p} · I${p.i}`}
          </li>
        ))}
      </ul>
    </div>
  );
}
