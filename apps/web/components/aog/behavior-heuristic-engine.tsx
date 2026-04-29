"use client";

import type { BehaviorFlag } from "@/lib/aog/disciplina-logic";
import { cn } from "@/lib/utils";

export function BehaviorHeuristicEngine({ flags }: { flags: BehaviorFlag[] }) {
  return (
    <div className="rounded-2xl border border-violet-900/35 bg-[#0c0814] p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-violet-300/90">Heurística de comportamento · front-only</p>
      <ul className="mt-3 space-y-2 text-xs">
        {flags.length === 0 ? (
          <li className="text-zinc-500">Sem sinal comportamental destacado.</li>
        ) : (
          flags.map((f, i) => (
            <li key={i} className="rounded-lg border border-white/5 px-3 py-2">
              <span className="font-mono text-[10px] text-violet-400">{f.kind}</span>
              <span className={cn("ml-2 text-[10px]", f.level === "grave" ? "text-orange-400" : "text-amber-500")}>
                {f.level}
              </span>
              <p className="mt-1 text-zinc-300">{f.text}</p>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
