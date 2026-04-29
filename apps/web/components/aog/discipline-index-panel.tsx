"use client";

export function DisciplineIndexPanel({ score, factors }: { score: number; factors: string[] }) {
  return (
    <div className="rounded-2xl border border-cyan-900/40 bg-[#061018] p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-cyan-300/80">DOI · Discipline operational index</p>
      <div className="mt-4 flex flex-wrap items-end gap-6">
        <div className="font-mono text-5xl font-extralight text-white">{score}</div>
        <div className="flex-1">
          <div className="h-3 overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full bg-gradient-to-r from-cyan-700 to-emerald-500" style={{ width: `${score}%` }} />
          </div>
          <p className="mt-2 text-[10px] text-zinc-500">100 = baseline disciplinar mais forte (heurístico)</p>
        </div>
      </div>
      <ul className="mt-4 space-y-1 text-xs text-zinc-400">
        {factors.map((f, i) => (
          <li key={i}>— {f}</li>
        ))}
      </ul>
    </div>
  );
}
