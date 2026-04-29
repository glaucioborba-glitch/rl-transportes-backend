"use client";

import type { StabilizerKnob } from "@/lib/agi/self-correcting-logic";

export function StateStabilizer({ knobs }: { knobs: StabilizerKnob[] }) {
  return (
    <div className="rounded-2xl border border-teal-500/30 bg-[#050c0c] p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-teal-300/85">State‑stabilizer</p>
      <table className="mt-4 w-full text-left text-[11px]">
        <thead>
          <tr className="border-b border-white/10 text-[10px] uppercase text-zinc-500">
            <th className="py-2 pr-2">Parâmetro</th>
            <th className="py-2 pr-2">Valor</th>
            <th className="py-2">Δ</th>
          </tr>
        </thead>
        <tbody>
          {knobs.map((k) => (
            <tr key={k.id} className="border-b border-white/5 text-zinc-300">
              <td className="py-2 pr-2 text-white">{k.label}</td>
              <td className="py-2 pr-2 font-mono text-teal-200/90">{k.value}</td>
              <td className="py-2 text-zinc-500">{k.delta}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
