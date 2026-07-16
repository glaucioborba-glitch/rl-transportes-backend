"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { GateOrdemServicoItem, GateOsStatus } from "@/lib/gate/gate-cockpit-types";
import { ContainerNumber } from "@/components/ui/container-number";
import { formatDuracao } from "@/lib/gate/gate-cockpit-utils";

const OS_TONE: Record<GateOsStatus, string> = {
  PENDENTE: "text-amber-200",
  EM_EXECUCAO: "text-sky-200",
  APROVADA: "text-emerald-200",
  REJEITADA: "text-rose-200",
};

type Props = {
  items: GateOrdemServicoItem[];
  filtroStatus: string;
  onFiltroStatus: (s: string) => void;
};

export function GateOsPanel({ items, filtroStatus, onFiltroStatus }: Props) {
  function exportarCsv() {
    const header = "id,protocolo,placa,container,operador,status,duracao_min,turno,iniciada_em\n";
    const lines = items.map((r) =>
      [
        r.id,
        r.protocolo,
        r.placa ?? "",
        r.containersIso.join("|"),
        r.operador ?? "",
        r.osStatus,
        r.duracaoMin,
        r.turno,
        r.iniciadaEm,
      ].join(","),
    );
    const blob = new Blob([header + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `os-gate-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const statusOpts = ["TODOS", "PENDENTE", "EM_EXECUCAO", "APROVADA", "REJEITADA"];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {statusOpts.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onFiltroStatus(s)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium",
                filtroStatus === s ? "bg-white/15 text-white" : "text-zinc-500 hover:text-white",
              )}
            >
              {s === "TODOS" ? "Todos" : s.replace("_", " ")}
            </button>
          ))}
        </div>
        <Button type="button" size="sm" variant="outline" className="border-zinc-600" onClick={exportarCsv}>
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="border-b border-white/10 bg-white/[0.03] text-[10px] uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3 py-2.5">ID / Protocolo</th>
              <th className="px-3 py-2.5">Placa</th>
              <th className="px-3 py-2.5">Contêiner</th>
              <th className="px-3 py-2.5">Operador</th>
              <th className="px-3 py-2.5">Status OS</th>
              <th className="px-3 py-2.5">Turno</th>
              <th className="px-3 py-2.5">Duração</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="px-3 py-2">
                  <p className="font-mono text-[10px] text-zinc-600">{r.id.slice(0, 8)}…</p>
                  <p className="font-medium text-white">{r.protocolo}</p>
                </td>
                <td className="px-3 py-2 font-mono text-zinc-300">{r.placa ?? "—"}</td>
                <td className="px-3 py-2">
                  {r.containersIso.length ? (
                    <div className="space-y-1">
                      {r.containersIso.map((iso) => (
                        <ContainerNumber key={iso} value={iso} showLabel={false} size="sm" />
                      ))}
                    </div>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2 text-zinc-400">{r.operador ?? "—"}</td>
                <td className={cn("px-3 py-2 font-medium", OS_TONE[r.osStatus])}>
                  {r.osStatus.replace("_", " ")}
                </td>
                <td className="px-3 py-2 text-zinc-400">{r.turno}</td>
                <td className="px-3 py-2 text-zinc-300">{formatDuracao(r.duracaoMin)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length ? (
          <p className="py-8 text-center text-sm text-zinc-500">Nenhuma OS no dia com os filtros atuais.</p>
        ) : null}
      </div>
    </div>
  );
}
