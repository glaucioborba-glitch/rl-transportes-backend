"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type AuditRow = {
  id: string;
  createdAt: string;
  tabela: string;
  acao: string;
  usuario?: string | null;
  registroId?: string | null;
  dadosDepois?: unknown;
};

function toneFor(row: AuditRow): "ok" | "warn" | "crit" {
  const a = row.acao?.toUpperCase?.() ?? "";
  const t = (row.dadosDepois as Record<string, unknown> | undefined)?.tipo ?? "";
  const s = JSON.stringify(row.dadosDepois ?? "").toLowerCase();
  if (s.includes("403") || s.includes("escopo")) return "crit";
  if (a.includes("DELETE") || a.includes("UPDATE")) return "warn";
  if (String(t).includes("suspeit")) return "crit";
  return "ok";
}

export function AuditSecurityTable({ title, rows, extra }: { title: string; rows: AuditRow[]; extra?: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-amber-200/90">{title}</p>
      {extra}
      <div className="max-h-56 overflow-auto rounded-lg border border-white/10">
        <table className="w-full text-left text-[11px]">
          <thead className="sticky top-0 bg-zinc-950 text-zinc-500">
            <tr>
              <th className="p-2">Data</th>
              <th className="p-2">Ação</th>
              <th className="p-2">Tabela</th>
              <th className="p-2">Usuário</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-4 text-center text-zinc-500">
                  Sem eventos ou sem permissão de leitura.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const tone = toneFor(r);
                return (
                  <tr key={r.id} className="border-t border-white/5">
                    <td className="p-2 font-mono text-zinc-400">{r.createdAt.slice(0, 19)}</td>
                    <td className={cn("p-2 font-medium", tone === "crit" && "text-red-300", tone === "warn" && "text-amber-200")}>
                      {r.acao}
                    </td>
                    <td className="p-2 text-zinc-400">{r.tabela}</td>
                    <td className="max-w-[120px] truncate p-2 text-zinc-500">{r.usuario ?? "—"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
