"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ElasticityPanel({
  elasticidadeMedia,
  serieResumo,
  onSimulate,
}: {
  elasticidadeMedia: number | null;
  serieResumo: string;
  onSimulate: (precoAtual: number, precoNovo: number, custo: number, volume: number, elast?: number) => void;
}) {
  const [pa, setPa] = useState(120);
  const [pn, setPn] = useState(132);
  const [custo, setCusto] = useState(45);
  const [vol, setVol] = useState(400);
  const sens =
    elasticidadeMedia == null
      ? "—"
      : elasticidadeMedia < -0.8
        ? "Alta"
        : elasticidadeMedia < -0.35
          ? "Média"
          : "Baixa";
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-white/10 bg-zinc-950/50 p-4">
        <p className="text-xs font-bold uppercase text-zinc-500">Elasticidade média (12m)</p>
        <p className="mt-2 text-3xl font-bold tabular-nums text-emerald-300">
          {elasticidadeMedia != null ? elasticidadeMedia.toFixed(3) : "—"}
        </p>
        <p className="mt-1 text-sm text-zinc-400">
          Sensibilidade estimada: <span className="text-white">{sens}</span>
        </p>
        <p className="mt-2 text-[11px] text-zinc-600">{serieResumo}</p>
      </div>
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-4">
        <p className="text-xs font-bold uppercase text-emerald-400/90">Simulador (front + API)</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="text-[10px] text-zinc-500">
            Preço atual
            <input type="number" className="mt-1 w-full rounded border border-white/10 bg-zinc-900 px-2 py-1 text-sm" value={pa} onChange={(e) => setPa(Number(e.target.value))} />
          </label>
          <label className="text-[10px] text-zinc-500">
            Preço novo
            <input type="number" className="mt-1 w-full rounded border border-white/10 bg-zinc-900 px-2 py-1 text-sm" value={pn} onChange={(e) => setPn(Number(e.target.value))} />
          </label>
          <label className="text-[10px] text-zinc-500">
            Custo/un.
            <input type="number" className="mt-1 w-full rounded border border-white/10 bg-zinc-900 px-2 py-1 text-sm" value={custo} onChange={(e) => setCusto(Number(e.target.value))} />
          </label>
          <label className="text-[10px] text-zinc-500">
            Volume
            <input type="number" className="mt-1 w-full rounded border border-white/10 bg-zinc-900 px-2 py-1 text-sm" value={vol} onChange={(e) => setVol(Number(e.target.value))} />
          </label>
        </div>
        <Button type="button" className="mt-3 w-full bg-emerald-600 hover:bg-emerald-500" onClick={() => onSimulate(pa, pn, custo, vol, elasticidadeMedia ?? undefined)}>
          Projetar com GET /comercial/simulador
        </Button>
      </div>
    </div>
  );
}
