"use client";

import { useEffect, useState } from "react";
import type { ControlEffectivenessStatus, EffectivenessTriple } from "@/lib/grc/types";
import { grcGetEffectiveness, grcSetEffectiveness, grcStorageControls } from "@/lib/grc/storage";
import { cn } from "@/lib/utils";

const STAT: { v: ControlEffectivenessStatus; l: string }[] = [
  { v: "aprovado", l: "Aprovado" },
  { v: "reprovado", l: "Reprovado" },
  { v: "revisao", l: "Revisão" },
];

export function ControlEffectivenessChecklist() {
  const [state, setState] = useState<Record<string, EffectivenessTriple>>({});

  useEffect(() => {
    const controls = grcStorageControls();
    const base = grcGetEffectiveness();
    const next: Record<string, EffectivenessTriple> = { ...base };
    for (const c of controls) {
      if (!next[c.id]) {
        next[c.id] = { design: "revisao", execucao: "revisao", evidencias: "revisao" };
      }
    }
    setState(next);
    grcSetEffectiveness(next);
  }, []);

  function patch(id: string, k: keyof EffectivenessTriple, v: ControlEffectivenessStatus) {
    const n = { ...state, [id]: { ...state[id]!, [k]: v } };
    setState(n);
    grcSetEffectiveness(n);
  }

  const controls = grcStorageControls();

  return (
    <div className="space-y-4">
      {controls.map((c) => {
        const s = state[c.id] ?? { design: "revisao" as const, execucao: "revisao", evidencias: "revisao" };
        return (
          <div key={c.id} className="rounded-xl border border-white/10 bg-zinc-950/50 p-4">
            <p className="text-sm font-semibold text-indigo-200">{c.processo}</p>
            <p className="text-[11px] text-zinc-500">{c.controle}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {([
                ["design", "Design do controle"],
                ["execucao", "Execução"],
                ["evidencias", "Evidências disponíveis"],
              ] as const).map(([key, lab]) => (
                <label key={key} className="text-[10px] text-zinc-500">
                  {lab}
                  <select
                    className={cn(
                      "mt-1 w-full rounded border border-white/10 bg-zinc-900 px-2 py-1.5 text-xs",
                      s[key] === "aprovado" && "text-emerald-300",
                      s[key] === "reprovado" && "text-red-300",
                      s[key] === "revisao" && "text-amber-200",
                    )}
                    value={s[key]}
                    onChange={(e) => patch(c.id, key, e.target.value as ControlEffectivenessStatus)}
                  >
                    {STAT.map((o) => (
                      <option key={o.v} value={o.v}>
                        {o.l}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
