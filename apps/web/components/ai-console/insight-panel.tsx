"use client";

export function InsightPanel({ ticker, updatedAt }: { ticker: string; updatedAt: number }) {
  const t = new Date(updatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return (
    <div className="rounded-2xl border border-cyan-500/15 bg-gradient-to-br from-[#0a1620] to-[#050810] p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-300/80">State summary</p>
        <span className="font-mono text-[10px] text-zinc-500">{t}</span>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-zinc-300">{ticker}</p>
    </div>
  );
}
