"use client";

export function StrategicRiskPanel({ score, label }: { score: number; label: string }) {
  return (
    <div className="rounded-2xl border border-rose-500/25 bg-rose-950/10 p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-rose-200/90">Risco corporativo integrado · score front</p>
      <div className="mt-4 flex items-end gap-4">
        <span className="font-mono text-5xl font-light text-white">{score}</span>
        <div className="pb-2">
          <p className="text-xs text-zinc-400">/ 100 sintético</p>
          <p className="text-sm font-medium text-rose-100/90">{label}</p>
        </div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-800">
        <div className="h-full bg-gradient-to-r from-amber-500 to-rose-600" style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}
