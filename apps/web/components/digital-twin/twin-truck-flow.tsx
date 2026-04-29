"use client";

/** Fluxo animado portaria → gate → pátio → saída (2D). */
export function TwinTruckFlow({ intensity }: { intensity: number }) {
  const dur = Math.max(5, 14 - intensity);
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#050914] p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Fluxo de caminhões · proxy animado</p>
      <div className="relative mt-4 h-14 rounded-xl bg-gradient-to-r from-cyan-950/40 via-violet-950/30 to-emerald-950/40">
        <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-white/10" />
        <div
          className="absolute top-1/2 h-8 w-10 -translate-y-1/2 rounded-md bg-gradient-to-b from-cyan-400 to-cyan-700 shadow-lg shadow-cyan-500/30"
          style={{ animation: `twin-flow-x ${dur}s linear infinite` }}
        />
        <div
          className="absolute top-1/2 h-8 w-10 -translate-y-1/2 rounded-md bg-gradient-to-b from-violet-400 to-violet-800 opacity-80 shadow-lg"
          style={{ animation: `twin-flow-x ${dur}s linear ${(dur * 0.33).toFixed(2)}s infinite` }}
        />
      </div>
      <div className="mt-3 flex justify-between text-[9px] font-bold uppercase text-zinc-600">
        <span>Portaria</span>
        <span>Gate</span>
        <span>Pátio</span>
        <span>Saída</span>
      </div>
    </div>
  );
}
