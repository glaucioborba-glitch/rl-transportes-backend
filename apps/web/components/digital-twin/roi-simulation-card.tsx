"use client";

export function RoiSimulationCard({ data }: { data: Record<string, unknown> | null }) {
  if (!data) {
    return (
      <div className="rounded-2xl border border-dashed border-white/15 bg-[#060910] p-6 text-center text-sm text-zinc-600">
        Execute simulação de expansão para ver ROI proxy.
      </div>
    );
  }
  const ganho = Number(data.ganhoSlots ?? 0);
  const roi = Number(data.roiOperacionalProxy ?? 0);
  const pay = data.mesesPaybackProxy as number | null | undefined;
  const sat0 = Number(data.saturacaoAtualPct ?? 0);
  const sat1 = Number(data.saturacaoAposExpansaoPct ?? 0);
  return (
    <div className="rounded-2xl border border-emerald-500/25 bg-emerald-950/10 p-5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-300/90">ROI operacional · GET /simulador/expansao</p>
      <div className="mt-4 grid gap-3 font-mono text-sm sm:grid-cols-2">
        <div>
          <p className="text-[10px] text-zinc-500">Ganho de slots</p>
          <p className="text-xl text-white">{ganho}</p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500">ROI proxy</p>
          <p className="text-xl text-emerald-200">{roi.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500">Payback (meses)</p>
          <p className="text-xl text-white">{pay != null ? pay : "—"}</p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500">Sat. antes → depois</p>
          <p className="text-xl text-zinc-200">
            {sat0.toFixed(1)}% → {sat1.toFixed(1)}%
          </p>
        </div>
      </div>
      <p className="mt-3 text-[10px] text-zinc-600">Valores comparativos apenas — sem persistência.</p>
    </div>
  );
}
