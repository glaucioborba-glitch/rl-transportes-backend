"use client";

import type { FailSafeHit } from "@/lib/aog/regulation-logic";

export function FailSafeLayer({ hits }: { hits: FailSafeHit[] }) {
  return (
    <div className="rounded-2xl border border-red-900/45 bg-[#120508] p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-red-400/90">Anti-falha · fail-safe layer</p>
      {hits.length === 0 ? (
        <p className="mt-3 text-xs text-zinc-500">Nenhum bloqueio ativo para a ação proposta no cenário heurístico.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {hits.map((h) => (
            <li key={h.id} className="rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2 text-xs text-red-100/90">
              <p className="font-bold">AÇÃO PROIBIDA</p>
              <p className="text-red-200/80">{h.blocked}</p>
              <p className="mt-1 text-[10px] text-red-300/70">{h.reason}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
