"use client";

import { cn } from "@/lib/utils";
import type { RhTurno } from "@/lib/rh/types";

type BoardRow = {
  id: string;
  nome: string;
  role: string;
  turno: string;
};

const TURNOS: RhTurno[] = ["MANHÃ", "TARDE", "NOITE"];

export function TurnoAllocationBoard({ rows }: { rows: BoardRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="border-b border-white/10 bg-zinc-900/80 text-left text-zinc-400">
            <th className="px-3 py-2">Colaborador</th>
            <th className="px-3 py-2">Papel</th>
            {TURNOS.map((t) => (
              <th key={t} className="px-3 py-2 text-center">
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-white/5">
              <td className="px-3 py-2 font-medium text-zinc-200">{r.nome}</td>
              <td className="px-3 py-2 text-zinc-500">{r.role}</td>
              {TURNOS.map((t) => {
                const hit = r.turno === t || r.turno.toUpperCase().includes(t.slice(0, 4));
                return (
                  <td key={t} className="px-3 py-2 text-center">
                    <span
                      className={cn(
                        "inline-block h-3 w-10 rounded-full",
                        hit ? "bg-cyan-400/70 shadow-[0_0_12px_rgba(34,211,238,0.4)]" : "bg-zinc-800",
                      )}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
