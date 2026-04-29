"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { IsoRiskCategory, RiskRegisterRow } from "@/lib/grc/types";
import { grcRiskRegister, grcSetRiskRegister } from "@/lib/grc/storage";
import { heatClass, nivelRisco } from "@/lib/grc/derive-risks";
import { cn } from "@/lib/utils";

const CATS: { v: IsoRiskCategory; l: string }[] = [
  { v: "operacional", l: "Operacional" },
  { v: "financeiro", l: "Financeiro" },
  { v: "legal", l: "Legal" },
  { v: "estrategico", l: "Estratégico" },
  { v: "compliance", l: "Compliance" },
];

export function RiskRegisterTable({ onRegisterChange }: { onRegisterChange?: () => void }) {
  const [rows, setRows] = useState<RiskRegisterRow[]>(() => grcRiskRegister());

  function persist(next: RiskRegisterRow[]) {
    setRows(next);
    grcSetRiskRegister(next);
    onRegisterChange?.();
  }

  function addRow() {
    const impacto = 3;
    const probabilidade = 3;
    const n = nivelRisco(impacto, probabilidade);
    persist([
      ...rows,
      {
        id: crypto.randomUUID(),
        risco: "Novo risco",
        categoria: "operacional",
        causaRaiz: "",
        impacto,
        probabilidade,
        nivel: n,
        dono: "",
        mitigacao: "",
      },
    ]);
  }

  return (
    <div className="space-y-3">
      <Button type="button" size="sm" className="bg-red-900/70 hover:bg-red-800" onClick={addRow}>
        + Registrar risco
      </Button>
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="min-w-[1000px] w-full text-left text-[11px]">
          <thead className="bg-[#070a14] text-zinc-500">
            <tr>
              <th className="p-2">Risco</th>
              <th className="p-2">Categoria</th>
              <th className="p-2">Causa</th>
              <th className="p-2">I</th>
              <th className="p-2">P</th>
              <th className="p-2">Nível</th>
              <th className="p-2">Dono</th>
              <th className="p-2">Mitigação</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-white/5">
                <td className="p-1">
                  <input
                    className="w-full rounded border border-white/10 bg-zinc-900 px-1 py-1"
                    value={r.risco}
                    onChange={(e) => {
                      const v = e.target.value;
                      persist(rows.map((x) => (x.id === r.id ? { ...x, risco: v } : x)));
                    }}
                  />
                </td>
                <td className="p-1">
                  <select
                    className="w-full rounded border border-white/10 bg-zinc-900 px-1 py-1"
                    value={r.categoria}
                    onChange={(e) => {
                      const c = e.target.value as IsoRiskCategory;
                      persist(rows.map((x) => (x.id === r.id ? { ...x, categoria: c } : x)));
                    }}
                  >
                    {CATS.map((c) => (
                      <option key={c.v} value={c.v}>
                        {c.l}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-1">
                  <input
                    className="w-full rounded border border-white/10 bg-zinc-900 px-1 py-1"
                    value={r.causaRaiz}
                    onChange={(e) => persist(rows.map((x) => (x.id === r.id ? { ...x, causaRaiz: e.target.value } : x)))}
                  />
                </td>
                <td className="p-1">
                  <input
                    type="number"
                    min={1}
                    max={5}
                    className="w-12 rounded border border-white/10 bg-zinc-900 px-1 py-1 font-mono"
                    value={r.impacto}
                    onChange={(e) => {
                      const i = Math.min(5, Math.max(1, Number(e.target.value) || 1));
                      persist(
                        rows.map((x) => (x.id === r.id ? { ...x, impacto: i, nivel: nivelRisco(i, x.probabilidade) } : x)),
                      );
                    }}
                  />
                </td>
                <td className="p-1">
                  <input
                    type="number"
                    min={1}
                    max={5}
                    className="w-12 rounded border border-white/10 bg-zinc-900 px-1 py-1 font-mono"
                    value={r.probabilidade}
                    onChange={(e) => {
                      const p = Math.min(5, Math.max(1, Number(e.target.value) || 1));
                      persist(rows.map((x) => (x.id === r.id ? { ...x, probabilidade: p, nivel: nivelRisco(x.impacto, p) } : x)));
                    }}
                  />
                </td>
                <td className="p-1">
                  <span className={cn("inline-flex rounded px-2 py-1 font-mono font-bold", heatClass(r.nivel))}>{r.nivel}</span>
                </td>
                <td className="p-1">
                  <input
                    className="w-full rounded border border-white/10 bg-zinc-900 px-1 py-1"
                    value={r.dono}
                    onChange={(e) => persist(rows.map((x) => (x.id === r.id ? { ...x, dono: e.target.value } : x)))}
                  />
                </td>
                <td className="p-1">
                  <input
                    className="w-full rounded border border-white/10 bg-zinc-900 px-1 py-1"
                    value={r.mitigacao}
                    onChange={(e) => persist(rows.map((x) => (x.id === r.id ? { ...x, mitigacao: e.target.value } : x)))}
                  />
                </td>
                <td className="p-1">
                  <button
                    type="button"
                    className="text-[10px] text-rose-400 hover:underline"
                    onClick={() => persist(rows.filter((x) => x.id !== r.id))}
                  >
                    Remover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
