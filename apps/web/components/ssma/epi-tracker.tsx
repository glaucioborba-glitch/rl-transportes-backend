"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ssmaStorage } from "@/lib/ssma/storage";
import { cn } from "@/lib/utils";

type Log = { id: string; tipo: "entrega" | "vencimento" | "avaria"; item: string; data: string; nota: string };

type EpiPack = {
  epi: Record<string, number>;
  epc: Record<string, number>;
  logs: Log[];
};

const DEFAULT: EpiPack = {
  epi: { capacete: 12, bota: 18, luvas: 40, oculos: 22, colete: 8 },
  epc: { sinalizacao: 30, barreiras: 14, cones: 45, suportes: 9 },
  logs: [],
};

export function EpiTracker() {
  const [pack, setPack] = useState<EpiPack>(DEFAULT);

  useEffect(() => {
    const s = ssmaStorage.epi.get() as EpiPack | null;
    if (s?.epi && s.epc) setPack({ ...DEFAULT, ...s, logs: s.logs ?? [] });
  }, []);

  function persist(p: EpiPack) {
    setPack(p);
    ssmaStorage.epi.set(p);
  }

  function addLog(tipo: Log["tipo"], item: string, nota: string) {
    const log: Log = { id: crypto.randomUUID(), tipo, item, data: new Date().toISOString().slice(0, 16), nota };
    persist({ ...pack, logs: [log, ...pack.logs].slice(0, 80) });
  }

  const criticos = Object.entries({ ...pack.epi, ...pack.epc }).filter(([, n]) => n < 10);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-bold uppercase text-cyan-500/80">EPI — estoque (mock local)</p>
          <ul className="space-y-2">
            {Object.entries(pack.epi).map(([k, v]) => (
              <li key={k} className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2 text-sm">
                <span className="capitalize text-zinc-300">{k}</span>
                <span className={cn("font-mono", v < 10 ? "text-red-400" : "text-zinc-200")}>{v}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-2 text-xs font-bold uppercase text-cyan-500/80">EPC — estoque</p>
          <ul className="space-y-2">
            {Object.entries(pack.epc).map(([k, v]) => (
              <li key={k} className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2 text-sm">
                <span className="capitalize text-zinc-300">{k}</span>
                <span className={cn("font-mono", v < 10 ? "text-red-400" : "text-zinc-200")}>{v}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" className="bg-emerald-800/80" onClick={() => addLog("entrega", "luvas", "Reposição turno")}>
          + Entrega
        </Button>
        <Button type="button" size="sm" className="bg-amber-800/80" onClick={() => addLog("vencimento", "capacete", "Alerta treinamento")}>
          + Vencimento
        </Button>
        <Button type="button" size="sm" className="bg-red-900/70" onClick={() => addLog("avaria", "óculos", "Substituição")}>
          + Avaria
        </Button>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold text-zinc-500">Itens críticos (&lt; 10)</p>
        {criticos.length ? (
          <ul className="text-sm text-red-300">
            {criticos.map(([k, v]) => (
              <li key={k}>
                {k}: {v} un.
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500">Nenhum item abaixo do mínimo heurístico.</p>
        )}
      </div>

      <div className="max-h-48 overflow-auto rounded-lg border border-white/10">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-zinc-950 text-zinc-500">
            <tr>
              <th className="p-2">Data</th>
              <th className="p-2">Tipo</th>
              <th className="p-2">Item</th>
              <th className="p-2">Nota</th>
            </tr>
          </thead>
          <tbody>
            {pack.logs.map((l) => (
              <tr key={l.id} className="border-t border-white/5">
                <td className="p-2 font-mono text-zinc-400">{l.data}</td>
                <td className="p-2">{l.tipo}</td>
                <td className="p-2">{l.item}</td>
                <td className="p-2 text-zinc-500">{l.nota}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
