"use client";

import type { AuditRow } from "@/components/ssma/audit-security-table";
import { cn } from "@/lib/utils";

function tone(row: AuditRow): "crit" | "warn" | "ok" {
  const a = row.acao?.toUpperCase?.() ?? "";
  const s = JSON.stringify(row.dadosDepois ?? "").toLowerCase();
  if (s.includes("403") || s.includes("escopo")) return "crit";
  if (a.includes("DELETE")) return "crit";
  if (a.includes("UPDATE")) return "warn";
  return "ok";
}

function shortDepois(d: unknown): string {
  if (d == null) return "—";
  try {
    const t = JSON.stringify(d);
    return t.length > 80 ? `${t.slice(0, 78)}…` : t;
  } catch {
    return "—";
  }
}

export function AuditTrailTable({ rows }: { rows: AuditRow[] }) {
  return (
    <div className="max-h-[420px] overflow-auto rounded-xl border border-white/10">
      <table className="w-full text-left text-[10px]">
        <thead className="sticky top-0 z-[1] bg-[#060814] text-zinc-500">
          <tr>
            <th className="p-2">Quando</th>
            <th className="p-2">Quem</th>
            <th className="p-2">Onde (tabela)</th>
            <th className="p-2">O quê</th>
            <th className="p-2">Registro</th>
            <th className="p-2 min-w-[140px]">Detalhe</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="p-6 text-center text-zinc-500">
                Sem eventos.
              </td>
            </tr>
          ) : (
            rows.map((r) => {
              const t = tone(r);
              return (
                <tr key={r.id} className="border-t border-white/5">
                  <td className="whitespace-nowrap p-2 font-mono text-zinc-400">{r.createdAt.slice(0, 19)}</td>
                  <td className="max-w-[100px] truncate p-2 text-zinc-400">{r.usuario ?? "—"}</td>
                  <td className="p-2 text-zinc-300">{r.tabela}</td>
                  <td
                    className={cn("p-2 font-semibold", t === "crit" && "text-red-300", t === "warn" && "text-amber-200", t === "ok" && "text-zinc-400")}
                  >
                    {r.acao}
                  </td>
                  <td className="max-w-[80px] truncate p-2 font-mono text-zinc-500">{r.registroId ?? "—"}</td>
                  <td className="p-2 text-zinc-500">{shortDepois(r.dadosDepois)}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
