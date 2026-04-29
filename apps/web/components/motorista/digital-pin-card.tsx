"use client";

import { Hash } from "lucide-react";

export function DigitalPinCard({ pin, protocolo }: { pin: string; protocolo?: string }) {
  const digits = pin.padStart(6, "0").slice(-6).split("");

  return (
    <div className="rounded-2xl border-2 border-emerald-500/40 bg-emerald-950/30 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-emerald-300">
        <Hash className="h-4 w-4" />
        Senha eletrônica
      </div>
      {protocolo ? <p className="mb-2 font-mono text-xs text-slate-500">{protocolo}</p> : null}
      <div className="flex justify-center gap-2">
        {digits.map((d, i) => (
          <span
            key={`${i}-${d}`}
            className="flex h-14 w-11 items-center justify-center rounded-xl bg-black/60 text-3xl font-black tabular-nums tracking-tight text-white"
          >
            {d}
          </span>
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-slate-500">Apresente no guichê ou leitor do gate</p>
    </div>
  );
}
