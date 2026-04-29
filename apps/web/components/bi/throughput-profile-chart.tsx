"use client";

import { cn } from "@/lib/utils";

/** Barras horárias (24) e série diária (≤7) já normalizadas 0..1 ou contagens brutas. */
export function ThroughputProfileChart({
  hourly24,
  daily7,
  dayLabels,
  highlightHora,
  titleHourly = "Throughput relativo · 24h (mapa de calor)",
  titleDaily = "Volume diário · 7 dias",
}: {
  hourly24: number[];
  daily7: number[];
  dayLabels: string[];
  highlightHora: number | null;
  titleHourly?: string;
  titleDaily?: string;
}) {
  const maxH = Math.max(...hourly24, 1e-6);
  const maxD = Math.max(...daily7, 1e-6);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">{titleHourly}</p>
        <div className="flex h-28 items-end gap-px sm:gap-0.5">
          {hourly24.map((v, h) => {
            const n = v / maxH;
            const hi = highlightHora === h;
            return (
              <div
                key={h}
                title={`${h}h · ${(n * 100).toFixed(0)}%`}
                className={cn("min-w-0 flex-1 rounded-t-sm", hi ? "bg-violet-500" : "bg-cyan-600/70")}
                style={{ height: `${Math.max(6, n * 100)}%` }}
              />
            );
          })}
        </div>
        <div className="mt-1 flex justify-between font-mono text-[9px] text-zinc-600">
          <span>0h</span>
          <span>12h</span>
          <span>23h</span>
        </div>
      </div>
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">{titleDaily}</p>
        <div className="flex h-28 items-end gap-2">
          {daily7.map((v, i) => {
            const n = v / maxD;
            return (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full max-w-[40px] rounded-t bg-emerald-600/65"
                  style={{ height: `${Math.max(8, n * 100)}%` }}
                  title={`${dayLabels[i] ?? i}: ${v}`}
                />
                <span className="truncate text-[9px] text-zinc-500">{dayLabels[i] ?? i}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
