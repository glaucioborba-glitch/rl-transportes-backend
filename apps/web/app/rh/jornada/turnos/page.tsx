"use client";

import { useEffect, useState } from "react";
import { staffJson } from "@/lib/api/staff-client";
import { fetchRhDirectoryMerged } from "@/lib/rh/merge-directory";
import type { RhColaboradorDirectoryItem } from "@/lib/rh/types";
import { mockWeeklyHours } from "@/lib/rh/fatigue";
import { ShiftBar } from "@/components/rh/shift-bar";
import { WorkloadHeatmap } from "@/components/rh/workload-heatmap";
import { RhCard } from "@/components/rh/rh-card";
import { useStaffAuthStore } from "@/stores/staff-auth-store";

export default function RhJornadaTurnosPage() {
  const allowed = useStaffAuthStore((s) => s.user?.role === "ADMIN" || s.user?.role === "GERENTE");
  const [rows, setRows] = useState<RhColaboradorDirectoryItem[]>([]);
  const [heatmap, setHeatmap] = useState<number[][]>([]);

  useEffect(() => {
    void fetchRhDirectoryMerged().then((r) => {
      setRows(r);
      const cells: number[][] = [];
      for (let i = 0; i < 4; i++) {
        const row: number[] = [];
        for (let j = 0; j < 24; j++) {
          const base = r[j % Math.max(1, r.length)]?.operacoes24h ?? 1;
          row.push(base * (0.5 + ((i + j) % 5) * 0.15));
        }
        cells.push(row);
      }
      setHeatmap(cells);
    });
    const ini = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    void staffJson(`/relatorios/operacional/solicitacoes?dataInicio=${ini}&dataFim=${today}&page=1&limit=1`).catch(() => null);
  }, []);

  if (!allowed) return <p className="text-amber-400">Acesso restrito.</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Turnos 24h</h1>
        <p className="text-sm text-zinc-500">
          Cruzamento entre solicitações recentes (contexto) e horas trabalhadas estimadas no front.
        </p>
      </div>
      <RhCard title="Distribuição 24h (modelo)" subtitle="Barras por turno lógico">
        <ShiftBar
          segments={[
            { start: 6, end: 14, label: "Manhã", tone: "ok" },
            { start: 14, end: 22, label: "Tarde", tone: "warn" },
            { start: 22, end: 24, label: "Noite", tone: "crit" },
            { start: 0, end: 6, label: "Noite", tone: "crit" },
          ]}
        />
      </RhCard>
      <RhCard title="Heatmap carga × hora" subtitle="4 fatias (equipes)">
        {heatmap.length === 0 ? <p className="text-sm text-zinc-500">Carregando…</p> : <WorkloadHeatmap cells={heatmap} />}
      </RhCard>
      <RhCard title="Operações vs horas (proxy)">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs text-zinc-500">
                <th className="py-2">Colaborador</th>
                <th className="py-2">Ops 24h</th>
                <th className="py-2">Horas semana (front)</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 12).map((r) => (
                <tr key={r.id} className="border-b border-white/5">
                  <td className="py-2 text-zinc-200">{r.nome}</td>
                  <td className="py-2 font-mono text-cyan-300">{r.operacoes24h ?? "—"}</td>
                  <td className="py-2 font-mono text-amber-200">{mockWeeklyHours(r.id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </RhCard>
    </div>
  );
}
