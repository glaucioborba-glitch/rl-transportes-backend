"use client";

import { cn } from "@/lib/utils";

const DAYS = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];
const GROUPS = ["A", "B", "C"];

export type ScheduleCell = { group: string; turno: string; fixed?: boolean };

export function ScheduleMatrix({
  data,
}: {
  data: Record<string, ScheduleCell[]>;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="min-w-[640px] w-full border-collapse text-center text-[11px]">
        <thead>
          <tr className="border-b border-white/10 bg-zinc-900/90 text-zinc-400">
            <th className="px-2 py-2 text-left">Grupo</th>
            {DAYS.map((d) => (
              <th key={d} className="px-1 py-2">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {GROUPS.map((g) => (
            <tr key={g} className="border-b border-white/5">
              <td className="px-2 py-2 text-left font-mono text-cyan-300">{g}</td>
              {DAYS.map((d, i) => {
                const cell = data[g]?.[i];
                return (
                  <td key={d} className="px-1 py-2">
                    <div
                      className={cn(
                        "rounded-md px-1 py-1.5 font-medium",
                        cell?.turno.includes("NOITE")
                          ? "bg-indigo-500/25 text-indigo-100"
                          : cell?.turno.includes("TARDE")
                            ? "bg-amber-500/20 text-amber-100"
                            : "bg-cyan-500/15 text-cyan-100",
                      )}
                    >
                      {cell?.turno ?? "—"}
                      {cell?.fixed ? <span className="ml-1 text-[9px] text-zinc-500">fx</span> : null}
                    </div>
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
