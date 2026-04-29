"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ssmaStorage } from "@/lib/ssma/storage";
import type { ActionPlanRow } from "@/lib/ssma/types";
import { cn } from "@/lib/utils";

const EMPTY: ActionPlanRow = {
  id: "",
  who: "",
  what: "",
  where: "",
  when: "",
  why: "",
  how: "",
  howMuch: "",
  status: "aberto",
};

export function ActionPlanBoard() {
  const [rows, setRows] = useState<ActionPlanRow[]>([]);

  useEffect(() => {
    setRows(ssmaStorage.actions.list());
  }, []);

  function persist(next: ActionPlanRow[]) {
    setRows(next);
    ssmaStorage.actions.set(next);
  }

  function addRow() {
    persist([
      ...rows,
      {
        ...EMPTY,
        id: crypto.randomUUID(),
        status: "aberto",
        who: "",
        what: "",
        where: "",
        when: "",
        why: "",
        how: "",
        howMuch: "",
      },
    ]);
  }

  return (
    <div className="space-y-4">
      <Button type="button" size="sm" className="bg-amber-700" onClick={addRow}>
        + Linha 5W2H
      </Button>
      <div className="overflow-x-auto">
        <table className="min-w-[720px] w-full border-collapse text-left text-[11px]">
          <thead>
            <tr className="border-b border-white/10 text-zinc-500">
              <th className="p-2">Who</th>
              <th className="p-2">What</th>
              <th className="p-2">Where</th>
              <th className="p-2">When</th>
              <th className="p-2">Why</th>
              <th className="p-2">How</th>
              <th className="p-2">How much</th>
              <th className="p-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-white/5">
                {(["who", "what", "where", "when", "why", "how", "howMuch"] as const).map((k) => (
                  <td key={k} className="p-1">
                    <input
                      className="w-full rounded border border-white/10 bg-zinc-900 px-1 py-1 text-[11px]"
                      value={r[k]}
                      onChange={(e) => persist(rows.map((x) => (x.id === r.id ? { ...x, [k]: e.target.value } : x)))}
                    />
                  </td>
                ))}
                <td className="p-1">
                  <select
                    className={cn("w-full rounded border border-white/10 bg-zinc-900 px-1 py-1 text-[11px]", r.status === "fechado" && "text-emerald-400")}
                    value={r.status}
                    onChange={(e) =>
                      persist(rows.map((x) => (x.id === r.id ? { ...x, status: e.target.value as ActionPlanRow["status"] } : x)))
                    }
                  >
                    <option value="aberto">Aberto</option>
                    <option value="em_andamento">Em andamento</option>
                    <option value="fechado">Fechado</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
