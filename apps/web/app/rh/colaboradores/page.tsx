"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ApiError } from "@/lib/api/staff-client";
import { fetchRhDirectoryMerged } from "@/lib/rh/merge-directory";
import type { RhStaffRole } from "@/lib/rh/types";
import type { RhColaboradorDirectoryItem } from "@/lib/rh/types";
import { RhCard } from "@/components/rh/rh-card";
import { useStaffAuthStore } from "@/stores/staff-auth-store";

const ROLES: RhStaffRole[] = [
  "ADMIN",
  "GERENTE",
  "OPERADOR_PORTARIA",
  "OPERADOR_GATE",
  "OPERADOR_PATIO",
];

export default function RhColaboradoresPage() {
  const allowed = useStaffAuthStore((s) => s.user?.role === "ADMIN" || s.user?.role === "GERENTE");
  const [rows, setRows] = useState<RhColaboradorDirectoryItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [roleF, setRoleF] = useState<string>("");
  const [turnoF, setTurnoF] = useState<string>("");
  const [aptF, setAptF] = useState<string>("");
  const [nrF, setNrF] = useState<string>("");

  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const dir = await fetchRhDirectoryMerged();
        if (on) setRows(dir);
      } catch (e) {
        if (on) setErr(e instanceof ApiError ? e.message : "Erro ao listar");
      }
    })();
    return () => {
      on = false;
    };
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (roleF && r.role !== roleF) return false;
      if (turnoF && !String(r.turno).toUpperCase().includes(turnoF.toUpperCase())) return false;
      if (aptF && !r.aptidaoLabel.toLowerCase().includes(aptF.toLowerCase())) return false;
      if (nrF && !r.complianceNrLabel.toLowerCase().includes(nrF.toLowerCase())) return false;
      return true;
    });
  }, [rows, roleF, turnoF, aptF, nrF]);

  if (!allowed) {
    return <p className="text-center text-amber-400">Acesso restrito.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Colaboradores</h1>
        <p className="text-sm text-zinc-500">Internos — dados mesclados em tempo de execução no front.</p>
      </div>
      {err ? <p className="text-sm text-red-400">{err}</p> : null}

      <RhCard title="Filtros">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs text-zinc-500">
            Role
            <select
              className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-2 py-2 text-sm text-white"
              value={roleF}
              onChange={(e) => setRoleF(e.target.value)}
            >
              <option value="">Todos</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-zinc-500">
            Turno
            <select
              className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-2 py-2 text-sm text-white"
              value={turnoF}
              onChange={(e) => setTurnoF(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="MANH">MANHÃ</option>
              <option value="TARD">TARDE</option>
              <option value="NOIT">NOITE</option>
            </select>
          </label>
          <label className="text-xs text-zinc-500">
            Aptidão (texto)
            <input
              className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-2 py-2 text-sm"
              value={aptF}
              onChange={(e) => setAptF(e.target.value)}
              placeholder="ex: pátio"
            />
          </label>
          <label className="text-xs text-zinc-500">
            Compliance NR
            <input
              className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-2 py-2 text-sm"
              value={nrF}
              onChange={(e) => setNrF(e.target.value)}
              placeholder="Conforme / Reciclagem"
            />
          </label>
        </div>
      </RhCard>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="min-w-[900px] w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-zinc-900/90 text-xs uppercase text-zinc-500">
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Último acesso</th>
              <th className="px-3 py-2">Permissões</th>
              <th className="px-3 py-2">Ops 24h</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                <td className="px-3 py-2 font-medium text-white">
                  <Link href={`/rh/colaboradores/${encodeURIComponent(r.id)}`} className="text-cyan-400 hover:underline">
                    {r.nome}
                  </Link>
                </td>
                <td className="px-3 py-2 text-zinc-400">{r.email ?? "—"}</td>
                <td className="px-3 py-2 text-zinc-300">{r.role}</td>
                <td className="px-3 py-2">
                  <span
                    className={
                      r.status === "ativo"
                        ? "text-emerald-400"
                        : r.status === "afastado"
                          ? "text-amber-400"
                          : "text-red-300"
                    }
                  >
                    {r.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-zinc-500">{r.ultimoAcesso ?? "—"}</td>
                <td className="px-3 py-2 text-[11px] text-zinc-500">{r.permissions.slice(0, 4).join(", ") || "—"}</td>
                <td className="px-3 py-2 font-mono text-cyan-300">{r.operacoes24h ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
