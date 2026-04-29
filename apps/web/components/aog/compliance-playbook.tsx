"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

const ACTIONS = [
  { id: "b1", label: "Bloquear entrada (virtual)" },
  { id: "b2", label: "Priorizar saída" },
  { id: "b3", label: "Exigir dupla verificação" },
  { id: "b4", label: "Isolar quadra crítica" },
  { id: "b5", label: "Acionar auditoria interna" },
] as const;

export function CompliancePlaybook() {
  const [log, setLog] = useState<string[]>([]);
  return (
    <div className="rounded-2xl border border-slate-600/50 bg-[#06080e] p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-slate-300">Compliance playbook · autônomo (simulado)</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {ACTIONS.map((a) => (
          <Button
            key={a.id}
            type="button"
            variant="outline"
            size="sm"
            className="border-slate-500/50 text-xs text-zinc-200 hover:bg-white/10"
            onClick={() =>
              setLog((prev) => [`${new Date().toLocaleTimeString("pt-BR")} · ${a.label} (simulado)`, ...prev].slice(0, 8))
            }
          >
            {a.label}
          </Button>
        ))}
      </div>
      {log.length > 0 ? (
        <ul className="mt-4 max-h-40 overflow-auto font-mono text-[10px] text-zinc-500">
          {log.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
