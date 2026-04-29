"use client";

import { useEffect, useState } from "react";
import type { ControlEfficacy, ControlRowEfficacy } from "@/lib/grc/types";
import { grcSetControls, grcStorageControls } from "@/lib/grc/storage";
import { cn } from "@/lib/utils";

function badge(e: ControlEfficacy) {
  return cn(
    "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
    e === "efetivo" && "bg-emerald-900/60 text-emerald-200",
    e === "parcial" && "bg-amber-900/55 text-amber-100",
    e === "inefetivo" && "bg-red-900/60 text-red-100",
  );
}

export function InternalControlsMatrix() {
  const [rows, setRows] = useState<ControlRowEfficacy[]>([]);

  useEffect(() => {
    setRows(grcStorageControls());
  }, []);

  function persist(next: ControlRowEfficacy[]) {
    setRows(next);
    grcSetControls(next);
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[920px] w-full border-collapse text-left text-[11px]">
        <thead>
          <tr className="border-b border-white/10 text-zinc-500">
            <th className="p-2">Processo</th>
            <th className="p-2">Risco</th>
            <th className="p-2">Controle</th>
            <th className="p-2">Procedimento</th>
            <th className="p-2">Evidência</th>
            <th className="p-2">Periodicidade</th>
            <th className="p-2">Dono</th>
            <th className="p-2">Eficácia</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-white/5">
              <td className="p-2 font-medium text-indigo-200/90">{r.processo}</td>
              <td className="p-2 text-zinc-400">{r.risco}</td>
              <td className="p-2 text-zinc-300">{r.controle}</td>
              <td className="p-2 text-zinc-500">{r.procedimento}</td>
              <td className="p-2 text-zinc-500">{r.evidencia}</td>
              <td className="p-2 text-zinc-500">{r.periodicidade}</td>
              <td className="p-2 text-zinc-400">{r.dono}</td>
              <td className="p-2">
                <select
                  className={cn("rounded border border-white/10 bg-zinc-900 px-1 py-1 text-[10px]", badge(r.eficacia))}
                  value={r.eficacia}
                  onChange={(e) =>
                    persist(rows.map((x) => (x.id === r.id ? { ...x, eficacia: e.target.value as ControlEfficacy } : x)))
                  }
                >
                  <option value="efetivo">Efetivo</option>
                  <option value="parcial">Parcial</option>
                  <option value="inefetivo">Inefetivo</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[10px] text-zinc-600">Metadados e status salvos apenas no navegador.</p>
    </div>
  );
}
