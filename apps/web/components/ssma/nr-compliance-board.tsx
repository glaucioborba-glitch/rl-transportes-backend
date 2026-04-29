"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ssmaStorage } from "@/lib/ssma/storage";

const NR_LIST = [
  { id: "NR-06", nome: "EPI" },
  { id: "NR-11", nome: "Movimentação / empilhadeiras" },
  { id: "NR-12", nome: "Máquinas e equipamentos" },
  { id: "NR-17", nome: "Ergonomia" },
  { id: "NR-20", nome: "Inflamáveis" },
  { id: "NR-23", nome: "Brigada / incêndio" },
  { id: "NR-33", nome: "Espaços confinados" },
  { id: "NR-35", nome: "Trabalho em altura" },
] as const;

type ColNr = { id: string; nome: string; validPercent: number; reciclagemPendente: boolean };

export function NrComplianceBoard() {
  const [cols, setCols] = useState<ColNr[]>([]);

  useEffect(() => {
    const mock = ssmaStorage.nrMock.get() as { colaboradores?: ColNr[] } | null;
    if (mock?.colaboradores?.length) {
      setCols(mock.colaboradores);
      return;
    }
    const seed: ColNr[] = [
      { id: "c1", nome: "Equipe turno A", validPercent: 86, reciclagemPendente: true },
      { id: "c2", nome: "Equipe turno B", validPercent: 92, reciclagemPendente: false },
      { id: "c3", nome: "Manutenção", validPercent: 78, reciclagemPendente: true },
      { id: "c4", nome: "Administrativo visitante", validPercent: 64, reciclagemPendente: true },
    ];
    setCols(seed);
    ssmaStorage.nrMock.set({ colaboradores: seed });
  }, []);

  const aptos = cols.filter((c) => c.validPercent >= 80).length;
  const pctAptos = cols.length ? Math.round((aptos / cols.length) * 100) : 0;
  const pend = cols.filter((c) => c.reciclagemPendente).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/20 px-4 py-3">
          <p className="text-[10px] font-bold uppercase text-emerald-400">% equipe apta</p>
          <p className="text-2xl font-bold text-white">{pctAptos}%</p>
        </div>
        <div className="rounded-xl border border-amber-500/25 bg-amber-950/15 px-4 py-3">
          <p className="text-[10px] font-bold uppercase text-amber-300">Reciclagens pendentes</p>
          <p className="text-2xl font-bold text-white">{pend}</p>
        </div>
        <div className="rounded-xl border border-red-500/25 bg-red-950/15 px-4 py-3">
          <p className="text-[10px] font-bold uppercase text-red-300">Riscos emergentes</p>
          <p className="text-2xl font-bold text-white">{pend + (pctAptos < 85 ? 1 : 0)}</p>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-zinc-950/40 p-4">
        <p className="mb-3 text-xs font-bold uppercase text-zinc-500">NRs-chave (referência)</p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {NR_LIST.map((nr) => (
            <li key={nr.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-black/30 px-3 py-2 text-sm">
              <span className="font-mono text-amber-200">{nr.id}</span>
              <span className="text-zinc-400">{nr.nome}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-bold uppercase text-zinc-500">Validade simulada por célula (local)</p>
        <div className="space-y-2">
          {cols.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 px-3 py-2">
              <span className="flex-1 text-sm text-zinc-300">{c.nome}</span>
              <span className="font-mono text-xs text-amber-300">{c.validPercent}%</span>
              {c.reciclagemPendente ? <span className="rounded bg-amber-900/40 px-2 py-0.5 text-[10px] text-amber-200">Reciclagem</span> : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 border-zinc-600 text-[10px]"
                onClick={() => {
                  const next = cols.map((x) =>
                    x.id === c.id ? { ...x, validPercent: Math.min(100, x.validPercent + 4), reciclagemPendente: false } : x,
                  );
                  setCols(next);
                  ssmaStorage.nrMock.set({ colaboradores: next });
                }}
              >
                Simular conclusão
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
