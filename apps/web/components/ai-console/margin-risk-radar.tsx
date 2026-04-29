"use client";

type Axes = { margem: number; ticket: number; lucro: number; container: number; risco: number };

export function MarginRiskRadar({ axes }: { axes: Axes }) {
  const rows: { k: keyof Axes; label: string }[] = [
    { k: "margem", label: "Margem" },
    { k: "ticket", label: "Ticket" },
    { k: "lucro", label: "Lucro" },
    { k: "container", label: "Container" },
    { k: "risco", label: "Risco rev." },
  ];
  return (
    <div className="rounded-2xl border border-white/10 bg-[#080818] p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-violet-300/80">Radar margem & risco</p>
      <div className="mt-4 space-y-2">
        {rows.map(({ k, label }) => (
          <div key={k} className="flex items-center gap-2 text-[11px]">
            <span className="w-24 shrink-0 text-zinc-500">{label}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-600 to-cyan-500"
                style={{ width: `${Math.min(100, Math.max(0, axes[k]))}%` }}
              />
            </div>
            <span className="w-8 font-mono text-zinc-400">{Math.round(axes[k])}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
