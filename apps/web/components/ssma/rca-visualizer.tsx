"use client";

import { useEffect, useState } from "react";
import { ssmaStorage } from "@/lib/ssma/storage";

export function RcaVisualizer() {
  const [whys, setWhys] = useState<string[]>(["", "", "", "", ""]);
  const [root, setRoot] = useState("Hipótese de causa raiz (preencher após análise)");

  useEffect(() => {
    setWhys(ssmaStorage.rca.getFiveWhys());
  }, []);

  function save(w: string[]) {
    setWhys(w);
    ssmaStorage.rca.setFiveWhys(w);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div>
        <p className="mb-2 text-xs font-bold uppercase text-amber-500/90">5 Porquês</p>
        <ol className="space-y-2">
          {whys.map((q, i) => (
            <li key={i} className="text-sm">
              <span className="font-mono text-zinc-500">{i + 1}.</span>
              <input
                className="ml-2 w-[calc(100%-2rem)] rounded border border-white/10 bg-zinc-900 px-2 py-1 text-sm"
                value={q}
                placeholder={`Por quê ${i + 1}?`}
                onChange={(e) => {
                  const n = [...whys];
                  n[i] = e.target.value;
                  save(n);
                }}
              />
            </li>
          ))}
        </ol>
      </div>
      <div>
        <p className="mb-2 text-xs font-bold uppercase text-amber-500/90">Árvore de falhas (resumo)</p>
        <div className="rounded-xl border border-amber-500/20 bg-zinc-950/60 p-4 font-mono text-xs leading-relaxed text-zinc-300">
          <div className="border-l-2 border-amber-600 pl-3">
            <p className="text-amber-200">Evento topo</p>
            <div className="mt-2 border-l-2 border-zinc-600 pl-3">
              <p> causa contribuinte A</p>
              <div className="mt-1 border-l-2 border-zinc-700 pl-3 text-zinc-500">{whys[0] || "—"}</div>
            </div>
            <div className="mt-2 border-l-2 border-zinc-600 pl-3">
              <p> causa contribuinte B</p>
              <div className="mt-1 border-l-2 border-zinc-700 pl-3 text-zinc-500">{whys[1] || "—"}</div>
            </div>
          </div>
        </div>
        <label className="mt-4 block text-[11px] text-zinc-500">
          Registro LTI/LTC / RCA
          <textarea
            className="mt-1 w-full rounded border border-white/10 bg-zinc-900 px-2 py-2 text-sm"
            value={root}
            onChange={(e) => setRoot(e.target.value)}
            rows={3}
          />
        </label>
        <p className="mt-3 text-[11px] text-zinc-600">Ferramenta local — não substitui investigação formal obrigatória.</p>
      </div>
    </div>
  );
}
