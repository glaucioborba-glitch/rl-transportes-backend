"use client";

const ITEMS = [
  { color: "bg-slate-500", text: "Pendente / aguardando" },
  { color: "bg-amber-400", text: "Em andamento" },
  { color: "bg-emerald-500", text: "Concluído nesta etapa" },
];

export function StatusLegend() {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Legenda</p>
      <ul className="space-y-1 text-xs text-slate-400">
        {ITEMS.map((i) => (
          <li key={i.text} className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${i.color}`} />
            {i.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
