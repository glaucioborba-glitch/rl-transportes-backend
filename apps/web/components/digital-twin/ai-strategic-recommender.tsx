"use client";

export function AiStrategicRecommender({
  recs,
}: {
  recs: { tipo?: string; titulo?: string; descricao?: string; prioridade?: string }[];
}) {
  if (!recs.length) {
    return <p className="text-sm text-zinc-600">Sem recomendações no período.</p>;
  }
  return (
    <ul className="max-h-72 space-y-3 overflow-auto pr-1">
      {recs.slice(0, 16).map((r, i) => (
        <li key={i} className="rounded-xl border border-fuchsia-500/25 bg-fuchsia-950/10 px-4 py-3">
          <p className="text-xs font-bold text-fuchsia-200/90">{r.titulo}</p>
          <p className="mt-1 text-[11px] text-zinc-400">{r.descricao}</p>
          <p className="mt-2 text-[9px] uppercase tracking-wide text-zinc-600">
            {r.tipo ?? "—"} · {r.prioridade ?? "—"}
          </p>
        </li>
      ))}
    </ul>
  );
}
