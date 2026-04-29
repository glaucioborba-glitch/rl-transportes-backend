"use client";

export function StrategicRecommender({ lines }: { lines: string[] }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-[#0a0a10] p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-400">Strategic recommendations · boardroom</p>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-zinc-300">
        {lines.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ol>
    </div>
  );
}
