"use client";

import { cn } from "@/lib/utils";
import type { TwinGlobalMode, TwinRiskBand } from "@/lib/digital-twin/derive";
import { bandColorCss, modeLabel } from "@/lib/digital-twin/derive";

export function TwinGlobalStatus({
  mode,
  band,
  satPct,
  updatedAt,
}: {
  mode: TwinGlobalMode;
  band: TwinRiskBand;
  satPct: number;
  updatedAt: number;
}) {
  const mCol =
    mode === "normal"
      ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-200"
      : mode === "atrasado"
        ? "border-amber-500/40 bg-amber-950/25 text-amber-100"
        : mode === "congestionado"
          ? "border-orange-500/40 bg-orange-950/20 text-orange-100"
          : "border-red-500/45 bg-red-950/30 text-red-100";

  const bc = bandColorCss(band);
  const t = updatedAt ? new Date(updatedAt).toLocaleTimeString("pt-BR") : "—";

  return (
    <div className="flex flex-wrap items-stretch gap-4">
      <div className={cn("flex min-w-[220px] flex-1 flex-col rounded-2xl border px-5 py-4", mCol)}>
        <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">Status global</p>
        <p className="mt-2 text-2xl font-light">{modeLabel(mode)}</p>
        <p className="mt-1 text-xs opacity-90">Saturação pátio · {satPct.toFixed(1)}%</p>
      </div>
      <div
        className="flex min-w-[180px] flex-col rounded-2xl border px-5 py-4"
        style={{ borderColor: bc.stroke, backgroundColor: bc.fill }}
      >
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Banda de risco</p>
        <p className="mt-2 text-xl font-semibold capitalize" style={{ color: bc.stroke }}>
          {band}
        </p>
        <p className="mt-1 text-[11px] text-zinc-500"> Verde · âmbar · vermelho · púrpura (violação)</p>
      </div>
      <div className="flex min-w-[160px] flex-col justify-center rounded-2xl border border-white/10 bg-[#060a14] px-5 py-4">
        <p className="text-[10px] font-bold uppercase text-zinc-500">Última telemetria</p>
        <p className="mt-1 font-mono text-lg text-cyan-200/80">{t}</p>
        <p className="text-[10px] text-zinc-600">Polling ~8s</p>
      </div>
    </div>
  );
}
