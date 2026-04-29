"use client";

import { useState } from "react";
import { buildCenarioQuery } from "@/lib/digital-twin/cenario-qs";
import { Button } from "@/components/ui/button";

export function ScenarioBoard({ onRun, loading }: { onRun: (querySuffix: string) => void; loading: boolean }) {
  const [aumentoDemandaPercentual, setDemanda] = useState(12);
  const [expansaoQuadras, setExpQuad] = useState(0);
  const [novoClienteVolumeEstimado, setVol] = useState(0);
  const [reducaoTurnoHoras, setRedTurno] = useState(0);
  const [aumentoTurnoHoras, setAumTurno] = useState(0);

  return (
    <div className="rounded-2xl border border-violet-500/20 bg-[#0a0618] p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-violet-200/80">Cenários what-if · /simulador/cenario</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-[10px] text-zinc-500">
          Demanda +%
          <input
            type="number"
            className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white"
            value={aumentoDemandaPercentual}
            onChange={(e) => setDemanda(Number(e.target.value))}
          />
        </label>
        <label className="text-[10px] text-zinc-500">
          Expansão quadras
          <input
            type="number"
            className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white"
            value={expansaoQuadras}
            onChange={(e) => setExpQuad(Number(e.target.value))}
          />
        </label>
        <label className="text-[10px] text-zinc-500">
          Vol. novo cliente
          <input
            type="number"
            className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white"
            value={novoClienteVolumeEstimado}
            onChange={(e) => setVol(Number(e.target.value))}
          />
        </label>
        <label className="text-[10px] text-zinc-500">
          Reduz turno (h/dia)
          <input
            type="number"
            className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white"
            value={reducaoTurnoHoras}
            onChange={(e) => setRedTurno(Number(e.target.value))}
          />
        </label>
        <label className="text-[10px] text-zinc-500">
          Aumenta turno (h/dia)
          <input
            type="number"
            className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white"
            value={aumentoTurnoHoras}
            onChange={(e) => setAumTurno(Number(e.target.value))}
          />
        </label>
      </div>
      <Button
        type="button"
        className="mt-4 bg-violet-600 hover:bg-violet-500"
        disabled={loading}
        onClick={() =>
          onRun(
            buildCenarioQuery({
              aumentoDemandaPercentual,
              expansaoQuadras,
              novoClienteVolumeEstimado,
              reducaoTurnoHoras,
              aumentoTurnoHoras,
            }),
          )
        }
      >
        Rodar simulação
      </Button>
    </div>
  );
}
