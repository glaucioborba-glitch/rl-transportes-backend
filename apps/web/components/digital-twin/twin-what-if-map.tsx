"use client";

import { bandColorCss, type TwinRiskBand } from "@/lib/digital-twin/derive";

export function TwinWhatIfMap({
  satPct,
  riskLabel,
  criticalQuadras,
}: {
  satPct: number;
  riskLabel: string;
  criticalQuadras: string[];
}) {
  const band: TwinRiskBand = satPct >= 92 ? "overload" : satPct >= 80 ? "crit" : satPct >= 68 ? "semi" : "normal";
  const c = bandColorCss(band);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#040814] p-4">
      <p className="text-[10px] font-bold uppercase text-zinc-500">Mapa what-if · heat previsto</p>
      <div
        className="relative mt-3 grid h-52 grid-cols-4 gap-2 rounded-xl p-3"
        style={{ boxShadow: `inset 0 0 60px ${c.glow}` }}
      >
        {Array.from({ length: 8 }).map((_, i) => {
          const isCrit = criticalQuadras.some((q) => q.includes(String(i + 1)));
          const localSat = Math.min(100, satPct + (isCrit ? 8 : -4) + (i % 3) * 3);
          const b = localSat >= 90 ? "overload" : localSat >= 75 ? "crit" : localSat >= 60 ? "semi" : "normal";
          const cc = bandColorCss(b);
          return (
            <div
              key={i}
              className="rounded-lg border-2 transition-all"
              style={{ borderColor: cc.stroke, backgroundColor: cc.fill }}
            >
              <p className="p-2 text-center text-[9px] font-mono text-white/90">{localSat.toFixed(0)}%</p>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-center text-xs text-zinc-400">{riskLabel}</p>
    </div>
  );
}
