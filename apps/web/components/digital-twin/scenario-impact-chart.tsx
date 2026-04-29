"use client";

export function ScenarioImpactChart({
  labels,
  saturacao,
  throughput,
}: {
  labels: string[];
  saturacao: number[];
  throughput: number[];
}) {
  const maxS = Math.max(1, ...saturacao);
  const maxT = Math.max(1, ...throughput);
  return (
    <div className="rounded-2xl border border-white/10 bg-[#050810] p-5">
      <p className="text-[10px] font-bold uppercase text-cyan-300/80">Saturação &amp; throughput (proxy visual)</p>
      <div className="mt-4 flex h-36 items-end gap-3">
        {labels.map((lab, i) => (
          <div key={lab} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex w-full max-w-[48px] flex-1 flex-col justify-end gap-1">
              <div
                className="w-full rounded-t bg-amber-500/70"
                style={{ height: `${(saturacao[i]! / maxS) * 100}%` }}
                title={`Sat ${saturacao[i]}`}
              />
              <div
                className="w-full rounded-t bg-cyan-500/70"
                style={{ height: `${(throughput[i]! / maxT) * 55}%` }}
                title={`TP ${throughput[i]}`}
              />
            </div>
            <span className="text-[9px] font-bold text-zinc-500">{lab}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
