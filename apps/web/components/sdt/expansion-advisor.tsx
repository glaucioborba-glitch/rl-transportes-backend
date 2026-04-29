"use client";

export function ExpansionAdvisor({ data, cap }: { data: Record<string, unknown> | null; cap: Record<string, unknown> | null }) {
  const d = data as {
    slotsAdicionaisEstimados?: number;
    paybackMesesProxy?: number;
    roiPercentualProxy?: number;
  } | null;
  const slots = cap?.slotsPorQuadraEstimado;
  return (
    <div className="rounded-2xl border border-teal-500/25 bg-[#061210] p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-teal-300/90">Auto-expansion advisor</p>
      {data == null ? (
        <p className="mt-3 text-xs text-zinc-500">Dados de expansão indisponíveis (permissão ou endpoint).</p>
      ) : (
        <dl className="mt-4 grid gap-3 font-mono text-sm text-zinc-200 sm:grid-cols-3">
          <div>
            <dt className="text-[10px] text-zinc-500">Expansão ideal (proxy)</dt>
            <dd>+{d?.slotsAdicionaisEstimados ?? "—"} slots</dd>
          </div>
          <div>
            <dt className="text-[10px] text-zinc-500">Payback</dt>
            <dd>{d?.paybackMesesProxy != null ? `${d.paybackMesesProxy} meses` : "—"}</dd>
          </div>
          <div>
            <dt className="text-[10px] text-zinc-500">ROI</dt>
            <dd>{d?.roiPercentualProxy != null ? `${Number(d.roiPercentualProxy).toFixed(1)}%` : "—"}</dd>
          </div>
          {slots != null ? (
            <div className="sm:col-span-3 text-[11px] text-zinc-500">Capacidade: slots/quadra estimado {String(slots)}</div>
          ) : null}
        </dl>
      )}
    </div>
  );
}
