"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function WhatIfConfigurator({
  onRun,
}: {
  onRun: (q: {
    aumentoDemandaPercentual?: number;
    reducaoTurnoHoras?: number;
    aumentoTurnoHoras?: number;
    expansaoQuadras?: number;
    novoClienteVolumeEstimado?: number;
  }) => void;
}) {
  const [demanda, setDemanda] = useState(10);
  const [redTurno, setRedTurno] = useState(0);
  const [addTurno, setAddTurno] = useState(0);
  const [quad, setQuad] = useState(0);
  const [novoCli, setNovoCli] = useState(0);
  return (
    <div className="rounded-2xl border border-violet-500/25 bg-violet-950/10 p-4">
      <p className="text-xs font-bold uppercase text-violet-300">What-if estratégico</p>
      <p className="mt-1 text-[11px] text-zinc-500">Parâmetros enviados a GET /simulador/cenario (query).</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-[10px] text-zinc-500">
          Δ demanda %
          <input type="number" className="mt-1 w-full rounded border border-white/10 bg-zinc-900 px-2 py-1 text-sm" value={demanda} onChange={(e) => setDemanda(Number(e.target.value))} />
        </label>
        <label className="text-[10px] text-zinc-500">
          Reduz turno (h/dia)
          <input type="number" className="mt-1 w-full rounded border border-white/10 bg-zinc-900 px-2 py-1 text-sm" value={redTurno} onChange={(e) => setRedTurno(Number(e.target.value))} />
        </label>
        <label className="text-[10px] text-zinc-500">
          Aumenta turno (h/dia)
          <input type="number" className="mt-1 w-full rounded border border-white/10 bg-zinc-900 px-2 py-1 text-sm" value={addTurno} onChange={(e) => setAddTurno(Number(e.target.value))} />
        </label>
        <label className="text-[10px] text-zinc-500">
          Expansão quadras
          <input type="number" className="mt-1 w-full rounded border border-white/10 bg-zinc-900 px-2 py-1 text-sm" value={quad} onChange={(e) => setQuad(Number(e.target.value))} />
        </label>
        <label className="text-[10px] text-zinc-500 sm:col-span-2">
          Novo cliente (un./mês)
          <input type="number" className="mt-1 w-full rounded border border-white/10 bg-zinc-900 px-2 py-1 text-sm" value={novoCli} onChange={(e) => setNovoCli(Number(e.target.value))} />
        </label>
      </div>
      <Button
        type="button"
        className="mt-4 bg-violet-600 hover:bg-violet-500"
        onClick={() =>
          onRun({
            aumentoDemandaPercentual: demanda || undefined,
            reducaoTurnoHoras: redTurno || undefined,
            aumentoTurnoHoras: addTurno || undefined,
            expansaoQuadras: quad || undefined,
            novoClienteVolumeEstimado: novoCli || undefined,
          })
        }
      >
        Calcular cenário
      </Button>
    </div>
  );
}
