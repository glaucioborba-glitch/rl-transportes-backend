"use client";

export function RoiCard({
  title,
  ganhoSlots,
  roiProxy,
  paybackMeses,
  impactoCicloMin,
}: {
  title: string;
  ganhoSlots: number;
  roiProxy: number;
  paybackMeses: number | null;
  impactoCicloMin: number;
}) {
  return (
    <div className="rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-950/40 to-zinc-950/80 p-5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400">{title}</p>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-zinc-500">Ganho slots</p>
          <p className="text-2xl font-bold text-blue-200">{ganhoSlots}</p>
        </div>
        <div>
          <p className="text-zinc-500">ROI proxy</p>
          <p className="text-2xl font-bold text-cyan-300">{roiProxy.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-zinc-500">Payback (meses)</p>
          <p className="font-mono text-lg text-white">{paybackMeses ?? "—"}</p>
        </div>
        <div>
          <p className="text-zinc-500">Δ ciclo (min)</p>
          <p className="font-mono text-lg text-amber-200">{impactoCicloMin}</p>
        </div>
      </div>
    </div>
  );
}
