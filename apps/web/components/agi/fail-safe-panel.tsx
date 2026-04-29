"use client";

import { cn } from "@/lib/utils";

export function FailSafePanel({ active, score }: { active: boolean; score: number }) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-5 transition-all duration-500",
        active
          ? "border-red-500/60 bg-red-950/35 shadow-[0_0_32px_rgba(239,68,68,0.25)]"
          : "border-zinc-600/40 bg-[#080808]",
      )}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-red-300/90">Fail‑safe mode</p>
      {active ? (
        <div className="mt-4 animate-pulse">
          <p className="text-lg font-bold text-red-200">Protocolo anti‑colapso · ATIVO</p>
          <p className="mt-2 text-xs text-red-100/80">
            Risco &gt; 80% ({score}). Estabilização de fluxo simulada, prevenção de cascata e contenção preferencial.
          </p>
        </div>
      ) : (
        <p className="mt-3 text-xs text-zinc-500">Modo autônomo em vigia — aciona acima de 80% no score de falha.</p>
      )}
    </div>
  );
}
