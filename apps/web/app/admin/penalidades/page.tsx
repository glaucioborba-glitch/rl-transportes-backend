"use client";

import { useEffect, useState } from "react";
import { staffJson } from "@/lib/api/staff-client";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { lastNDays } from "@/lib/admin/dates";
import { readJson, adminContractsKey } from "@/lib/admin/storage";
import type { AdminContract } from "@/lib/admin/types";
import { ContractCard } from "@/components/admin/contract-card";

type Row = {
  cliente: string;
  operacao: string;
  slaFalho: string;
  penalidade: string;
};

export default function AdminPenalidadesPage() {
  const allowed = useStaffAuthStore((s) => s.user?.role === "ADMIN" || s.user?.role === "GERENTE");
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    const contracts = readJson<AdminContract[]>(adminContractsKey(), []);
    if (!contracts.length) {
      setRows([]);
      return;
    }
    const { ini, fim } = lastNDays(30);
    void staffJson<{
      gargalos: { violacoesGateSemPortaria: number; violacoesSaidaSemCompleto: number };
    }>(`/dashboard-performance?dataInicio=${ini}&dataFim=${fim}`)
      .then((perf) => {
        const out: Row[] = [];
        for (const c of contracts) {
          const fator = Math.max(0.01, c.penalidades.reduce((a, p) => a + p.fator, 0));
          const dias = 1 + (perf.gargalos.violacoesGateSemPortaria % 5);
          if (perf.gargalos.violacoesGateSemPortaria > 0) {
            out.push({
              cliente: c.clienteNome,
              operacao: "Gate-in / portaria",
              slaFalho: "Sequência gate sem portaria (agregado)",
              penalidade: (fator * dias * 15000).toFixed(0),
            });
          }
        }
        if (perf.gargalos.violacoesSaidaSemCompleto > 0 && contracts[0]) {
          const c = contracts[0];
          const fator = Math.max(0.01, c.penalidades.reduce((a, p) => a + p.fator, 0));
          out.push({
            cliente: c.clienteNome,
            operacao: "Expedição",
            slaFalho: "Saída incompleta",
            penalidade: (fator * 2 * 9000).toFixed(0),
          });
        }
        if (out.length === 0) {
          out.push({
            cliente: contracts[0]!.clienteNome,
            operacao: "—",
            slaFalho: "Sem violações agregadas no período",
            penalidade: "0",
          });
        }
        setRows(out);
      })
      .catch(() => setRows([]));
  }, []);

  if (!allowed) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold text-white">Penalidades</h1>
        <p className="text-sm text-zinc-500">penalidade ≈ fator × dias × tipo (ilustrativo).</p>
      </div>
      <ContractCard title="Tabela de penalidades calculadas" subtitle="Front-only · cruza contratos locais com performance">
        <div className="overflow-x-auto">
          <table className="min-w-[720px] w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase text-zinc-500">
                <th className="py-2">Cliente</th>
                <th className="py-2">Operação</th>
                <th className="py-2">SLA falho</th>
                <th className="py-2">Penalidade (proxy R$)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-white/5">
                  <td className="py-2">{r.cliente}</td>
                  <td className="py-2">{r.operacao}</td>
                  <td className="py-2 text-amber-200/90">{r.slaFalho}</td>
                  <td className="py-2 font-mono text-emerald-300">{r.penalidade}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ContractCard>
    </div>
  );
}
