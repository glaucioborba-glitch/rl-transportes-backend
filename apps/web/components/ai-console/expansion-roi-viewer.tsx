"use client";

export function ExpansionRoiViewer({ data }: { data: Record<string, unknown> | null }) {
  const d = data as {
    slotsAdicionaisEstimados?: number;
    investimentoEstimadoProxy?: number;
    receitaIncrementalAnualProxy?: number;
    paybackMesesProxy?: number;
    roiPercentualProxy?: number;
  } | null;
  if (data === null) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-xs text-zinc-500">
        ROI de expansão indisponível (permissão ou endpoint).
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-200/80">Expansão · /simulador/expansao</p>
      <dl className="mt-3 grid gap-2 font-mono text-[11px] text-zinc-300 sm:grid-cols-2">
        <div>
          <dt className="text-zinc-500">Slots +</dt>
          <dd>{d?.slotsAdicionaisEstimados ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Payback (meses)</dt>
          <dd>{d?.paybackMesesProxy ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">ROI proxy %</dt>
          <dd>{d?.roiPercentualProxy != null ? `${Number(d.roiPercentualProxy).toFixed(1)}%` : "—"}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Investimento proxy</dt>
          <dd>{d?.investimentoEstimadoProxy != null ? `R$ ${Number(d.investimentoEstimadoProxy).toLocaleString("pt-BR")}` : "—"}</dd>
        </div>
      </dl>
    </div>
  );
}
