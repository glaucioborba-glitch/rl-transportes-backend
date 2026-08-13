"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ContainerNumber } from "@/components/ui/container-number";
import { cn } from "@/lib/utils";
import type { GatePatioUnidade } from "@/lib/gate/gate-cockpit-types";

type FiltroStatus = "TODOS" | "Reefer" | "Dry";
type FiltroDias = "TODOS" | "MAIS_3";

type Props = {
  ocupados: number;
  capacidade: number;
  reefers: number;
  unidades: GatePatioUnidade[];
};

export function GatePatioPanel({ ocupados, capacidade, reefers, unidades }: Props) {
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("TODOS");
  const [filtroDias, setFiltroDias] = useState<FiltroDias>("TODOS");

  const rows = useMemo(() => {
    return unidades.filter((u) => {
      if (filtroStatus === "Reefer" && u.tipo !== "Reefer") return false;
      if (filtroStatus === "Dry" && u.tipo !== "Dry") return false;
      if (filtroDias === "MAIS_3" && u.diasNoPatio <= 3) return false;
      return true;
    });
  }, [unidades, filtroStatus, filtroDias]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-white/10 bg-[#0b1018]/80 px-4 py-3">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">Ocupação</p>
          <p className="text-2xl font-semibold text-white">
            {ocupados}
            <span className="text-lg text-zinc-500">/{capacidade}</span>
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">Reefers ligados</p>
          <p className="text-xl font-semibold text-sky-300">{reefers}</p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          {(["TODOS", "Reefer", "Dry"] as FiltroStatus[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFiltroStatus(f)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium",
                filtroStatus === f ? "bg-white/15 text-white" : "text-zinc-500 hover:text-white",
              )}
            >
              {f}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setFiltroDias(filtroDias === "MAIS_3" ? "TODOS" : "MAIS_3")}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium",
              filtroDias === "MAIS_3" ? "bg-amber-500/20 text-amber-100" : "text-zinc-500 hover:text-white",
            )}
          >
            &gt;3 dias
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-white/10 bg-white/[0.03] text-[10px] uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3 py-2.5">Stack / Posição</th>
              <th className="px-3 py-2.5">Contêiner</th>
              <th className="px-3 py-2.5">Tipo</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5">Entrada</th>
              <th className="px-3 py-2.5">Dias no pátio</th>
              <th className="px-3 py-2.5">Cliente</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr
                key={u.unidadeId}
                className={cn(
                  "border-b border-white/5 hover:bg-white/[0.02]",
                  u.diasNoPatio > 3 && "bg-amber-500/[0.06]",
                )}
              >
                <td className="px-3 py-2 font-mono text-zinc-300">{u.posicao}</td>
                <td className="px-3 py-2">
                  <ContainerNumber value={u.container} showLabel={false} size="sm" />
                </td>
                <td className="px-3 py-2">
                  <Badge variant="neutral" className={u.refrigerado ? "border-sky-500/40 text-sky-200" : ""}>
                    {u.tipo}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-zinc-400">{u.status}</td>
                <td className="px-3 py-2 text-zinc-400">
                  {new Date(u.entradaEm).toLocaleDateString("pt-BR")}
                </td>
                <td className="px-3 py-2">
                  <span className={cn("font-semibold", u.diasNoPatio > 3 ? "text-amber-300" : "text-zinc-300")}>
                    {u.diasNoPatio}
                  </span>
                </td>
                <td className="px-3 py-2 text-zinc-400">{u.cliente}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length ? (
          <p className="py-8 text-center text-sm text-zinc-500">Nenhuma unidade com os filtros atuais.</p>
        ) : null}
      </div>
    </div>
  );
}
