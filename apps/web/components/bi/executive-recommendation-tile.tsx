"use client";

import { cn } from "@/lib/utils";

export function ExecutiveRecommendationTile({
  items,
}: {
  items: { tipo: string; titulo: string; descricao: string; prioridade?: string }[];
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((it, i) => (
        <div
          key={i}
          className={cn(
            "rounded-xl border p-4",
            it.prioridade === "alta" ? "border-red-500/30 bg-red-950/20" : "border-white/10 bg-zinc-950/50",
          )}
        >
          <p className="text-[10px] font-bold uppercase text-blue-400">{it.tipo}</p>
          <p className="mt-1 font-semibold text-white">{it.titulo}</p>
          <p className="mt-2 text-sm text-zinc-400">{it.descricao}</p>
        </div>
      ))}
    </div>
  );
}
