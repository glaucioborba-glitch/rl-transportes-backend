"use client";

export function WorkloadDistribution({
  byOperador,
  byTurno,
  byEtapa,
}: {
  byOperador: { id: string; label: string; value: number }[];
  byTurno: { label: string; value: number }[];
  byEtapa: { label: string; value: number }[];
}) {
  const maxO = Math.max(...byOperador.map((x) => x.value), 1);
  const maxT = Math.max(...byTurno.map((x) => x.value), 1);
  const maxE = Math.max(...byEtapa.map((x) => x.value), 1);
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">Carga por operador</p>
        <div className="space-y-1">
          {byOperador.slice(0, 10).map((r) => (
            <div key={r.id} className="flex items-center gap-2 text-xs">
              <span className="w-24 truncate text-zinc-400">{r.label}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-800">
                <div className="h-full bg-gradient-to-r from-cyan-700 to-cyan-400" style={{ width: `${(r.value / maxO) * 100}%` }} />
              </div>
              <span className="font-mono text-zinc-500">{r.value}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">Por turno</p>
        <div className="flex h-32 items-end gap-2">
          {byTurno.map((t) => (
            <div key={t.label} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full max-w-[48px] rounded-t bg-emerald-600/60"
                style={{ height: `${Math.max(8, (t.value / maxT) * 100)}%` }}
              />
              <span className="text-[10px] text-zinc-500">{t.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">Por etapa (hist.)</p>
        <div className="space-y-2">
          {byEtapa.map((e) => (
            <div key={e.label} className="flex items-center gap-2">
              <span className="w-16 text-[11px] text-zinc-400">{e.label}</span>
              <div className="h-3 flex-1 overflow-hidden rounded bg-zinc-800">
                <div className="h-full bg-blue-500/70" style={{ width: `${(e.value / maxE) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
