"use client";

import { cn } from "@/lib/utils";

export function ThroughputPanel({
  portaria,
  gate,
  patio,
  saida,
  picoHora,
  p10,
  p50,
  p90,
  highlightHora,
}: {
  portaria: number | null;
  gate: number | null;
  patio: number | null;
  saida?: number | null;
  picoHora: number | null;
  p10: number;
  p50: number;
  p90: number;
  highlightHora: number | null;
}) {
  const tiles = [
    { label: "Portaria", value: portaria, u: "u/h" },
    { label: "Gate", value: gate, u: "u/h" },
    { label: "Pátio", value: patio, u: "u/h" },
    ...(saida != null ? [{ label: "Saída", value: saida, u: "u/h" }] : []),
  ];
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{t.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-cyan-300">{t.value != null ? t.value.toFixed(1) : "—"}</p>
            <p className="text-[10px] text-zinc-600">{t.u}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2">
          <p className="text-[10px] uppercase text-amber-200/80">Pico 24h (hora)</p>
          <p className="text-lg font-mono font-bold text-amber-100">{picoHora != null ? `${picoHora}h` : "—"}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-zinc-950/50 px-3 py-2 sm:col-span-2">
          <p className="text-[10px] uppercase text-zinc-500">Dispersão eventos (proxy)</p>
          <p className="font-mono text-sm text-zinc-300">
            P10 <span className="text-emerald-400">{p10.toFixed(1)}</span> · P50{" "}
            <span className="text-cyan-400">{p50.toFixed(1)}</span> · P90 <span className="text-red-300">{p90.toFixed(1)}</span>
          </p>
        </div>
      </div>
      {highlightHora != null ? (
        <p className={cn("rounded-lg border px-3 py-2 text-xs", "border-violet-500/40 bg-violet-500/10 text-violet-200")}>
          IA · gargalo do dia: maior densidade em torno de <span className="font-mono font-bold">{highlightHora}h</span>
        </p>
      ) : null}
    </div>
  );
}
