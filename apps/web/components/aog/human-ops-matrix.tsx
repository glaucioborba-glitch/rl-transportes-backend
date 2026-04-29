"use client";

import type { AuditRow } from "@/components/ssma/audit-security-table";
import { cn } from "@/lib/utils";

export function HumanOpsMatrix({ rows }: { rows: AuditRow[] }) {
  const users = Array.from(new Set(rows.map((r) => r.usuario).filter((u): u is string => Boolean(u)))).slice(0, 8);
  const tables = Array.from(new Set(rows.map((r) => r.tabela))).slice(0, 7);
  const maxN = Math.max(1, ...users.flatMap((u) => tables.map((t) => rows.filter((r) => r.usuario === u && r.tabela === t).length)));

  function cell(u: string | null, t: string) {
    const n = rows.filter((r) => r.usuario === u && r.tabela === t).length;
    const intensity = n / maxN;
    return (
      <div
        className={cn("flex h-8 items-center justify-center rounded text-[10px] font-mono text-white/90")}
        style={{
          backgroundColor: `rgba(30, 58, 138, ${0.15 + intensity * 0.75})`,
        }}
      >
        {n || "·"}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-blue-900/40 bg-[#060a14] p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-blue-300/80">Processo × pessoa × tempo (agregado)</p>
      <div className="mt-4 overflow-x-auto">
        <div className="inline-grid gap-1" style={{ gridTemplateColumns: `90px repeat(${tables.length}, minmax(36px,1fr))` }}>
          <div />
          {tables.map((t) => (
            <div key={t} className="truncate px-0.5 text-center text-[9px] text-zinc-500" title={t}>
              {t.slice(0, 6)}
            </div>
          ))}
          {users.map((u) => (
            <div key={u} className="contents">
              <div className="truncate pr-2 text-[10px] text-zinc-400" title={u}>
                {u.slice(0, 12)}
              </div>
              {tables.map((t) => (
                <div key={`${u}-${t}`}>{cell(u, t)}</div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 text-[10px] text-zinc-600">Contagem de eventos de auditoria no recorte — azul mais intenso = mais eventos.</p>
    </div>
  );
}
