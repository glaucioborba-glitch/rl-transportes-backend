"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import type { MemoryEntry } from "@/lib/agi/self-learning-logic";
import { appendHeuristicMemory, averageEfficacyByHeuristic } from "@/lib/agi/self-learning-logic";
import { cn } from "@/lib/utils";

export function HeuristicMemory(props: {
  entries: MemoryEntry[];
  onChange: (next: MemoryEntry[]) => void;
}) {
  const avg = useMemo(() => averageEfficacyByHeuristic(props.entries), [props.entries]);

  return (
    <div className="rounded-2xl border border-emerald-500/25 bg-[#040a08] p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-emerald-400/80">Memory engine · local</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-emerald-500/40 text-xs text-emerald-100"
          onClick={() => {
            const next = appendHeuristicMemory({
              heuristicId: `h-${Date.now() % 1000}`,
              outcome: "worked",
              note: "Simulação: política de saída priorizada reduziu saturação proxy.",
              efficacyScore: 72 + Math.round(Math.random() * 15),
            });
            props.onChange(next);
          }}
        >
          Registrar sucesso (sim)
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-rose-500/40 text-xs text-rose-200"
          onClick={() => {
            const next = appendHeuristicMemory({
              heuristicId: `h-${Date.now() % 1000}`,
              outcome: "failed",
              note: "Simulação: ação aumentou fila gate — rollback mental.",
              efficacyScore: 28 + Math.round(Math.random() * 12),
            });
            props.onChange(next);
          }}
        >
          Registrar falha (sim)
        </Button>
      </div>
      {avg.length > 0 ? (
        <ul className="mt-4 space-y-1 text-[11px] text-zinc-400">
          {avg.map((a) => (
            <li key={a.id} className="flex justify-between gap-2 border-b border-white/5 py-1">
              <span className="font-mono text-zinc-500">{a.id}</span>
              <span>
                score médio <span className="text-emerald-300/90">{a.avg}</span> ({a.n} evt.)
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-xs text-zinc-600">Nenhuma memória ainda — use os botões para simular episódios.</p>
      )}
      <ul className="mt-3 max-h-32 overflow-auto text-[10px] text-zinc-600">
        {props.entries.slice(0, 6).map((e) => (
          <li key={e.id} className={cn("truncate", e.outcome === "worked" ? "text-emerald-600/90" : "text-rose-500/80")}>
            {new Date(e.ts).toLocaleString("pt-BR")} · {e.outcome} · {e.efficacyScore} — {e.note}
          </li>
        ))}
      </ul>
    </div>
  );
}
