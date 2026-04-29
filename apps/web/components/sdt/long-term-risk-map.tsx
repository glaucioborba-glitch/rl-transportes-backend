"use client";

export function LongTermRiskMap({
  satPct,
  inadPct,
  margemPct,
}: {
  satPct: number;
  inadPct: number;
  margemPct: number;
}) {
  const years = [1, 2, 3, 4, 5];
  const riskAt = (y: number) => {
    const base = satPct * 0.35 + inadPct * 4 + (margemPct < 14 ? 22 : 0);
    return Math.min(100, base + y * 6);
  };
  return (
    <div className="rounded-2xl border border-rose-500/20 bg-[#10060a] p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-rose-300/90">Long-term risk map · fronteira 5 anos (sintético)</p>
      <div className="mt-6 flex h-40 items-end gap-2">
        {years.map((y) => {
          const h = riskAt(y);
          return (
            <div key={y} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex w-full flex-1 flex-col justify-end">
                <div
                  className="w-full rounded-t bg-gradient-to-t from-rose-900/80 to-amber-500/60"
                  style={{ height: `${h}%` }}
                />
              </div>
              <span className="font-mono text-[10px] text-zinc-500">Ano {y}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-[11px] text-zinc-500">
        Escala qualitativa agregando saturação, inadimplência projetada e compressão de margem — não substitui estudo econométrico.
      </p>
    </div>
  );
}
