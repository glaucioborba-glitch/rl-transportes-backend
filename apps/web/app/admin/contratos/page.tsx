"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import type { AdminContract, ContractStatus } from "@/lib/admin/types";
import { readJson, adminContractsKey } from "@/lib/admin/storage";
import { contractStatusFromDates } from "@/lib/admin/contract-helpers";
import { ContractCard } from "@/components/admin/contract-card";
import { Button } from "@/components/ui/button";

export default function AdminContratosPage() {
  const allowed = useStaffAuthStore((s) => s.user?.role === "ADMIN" || s.user?.role === "GERENTE");
  const [items, setItems] = useState<AdminContract[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [statusF, setStatusF] = useState<"" | ContractStatus>("");
  const [iniV, setIniV] = useState("");
  const [fimV, setFimV] = useState("");

  useEffect(() => {
    setItems(readJson<AdminContract[]>(adminContractsKey(), []).map(refreshStatus));
  }, []);

  const filtered = useMemo(() => {
    return items
      .map(refreshStatus)
      .filter((c) => {
        if (clienteId && c.clienteId !== clienteId) return false;
        if (statusF && c.status !== statusF) return false;
        if (iniV && c.vigenciaFim < iniV) return false;
        if (fimV && c.vigenciaInicio > fimV) return false;
        return true;
      });
  }, [items, clienteId, statusF, iniV, fimV]);

  if (!allowed) return null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-white">Contratos & SLA</h1>
          <p className="mt-1 text-sm text-zinc-500">Cadastro local · governança comercial e tabelas negociais.</p>
        </div>
        <Button asChild className="bg-emerald-600 hover:bg-emerald-500">
          <Link href="/admin/contratos/novo">Criar novo contrato</Link>
        </Button>
      </div>

      <ContractCard title="Filtros" subtitle="Governança">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs text-zinc-500">
            clienteId (UUID)
            <input
              className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-2 py-2 font-mono text-xs"
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value.trim())}
              placeholder="filtrar…"
            />
          </label>
          <label className="text-xs text-zinc-500">
            Status
            <select
              className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-2 py-2 text-sm"
              value={statusF}
              onChange={(e) => setStatusF(e.target.value as typeof statusF)}
            >
              <option value="">Todos</option>
              <option>Ativo</option>
              <option>Expirado</option>
              <option>Pendente Assinatura</option>
            </select>
          </label>
          <label className="text-xs text-zinc-500">
            Vigência até ≥
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-2 py-2 text-sm"
              value={iniV}
              onChange={(e) => setIniV(e.target.value)}
            />
          </label>
          <label className="text-xs text-zinc-500">
            Vigência início ≤
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-2 py-2 text-sm"
              value={fimV}
              onChange={(e) => setFimV(e.target.value)}
            />
          </label>
        </div>
      </ContractCard>

      <div className="grid gap-4 lg:grid-cols-2">
        {filtered.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhum contrato no período. Crie um novo ou ajuste os filtros.</p>
        ) : (
          filtered.map((c) => (
            <ContractCard
              key={c.id}
              title={c.clienteNome}
              subtitle={`${c.status} · v${c.versaoDoc}`}
              footer={
                <Link href={`/admin/contratos/${encodeURIComponent(c.id)}`} className="text-sm font-semibold text-sky-400 hover:underline">
                  Abrir pasta do contrato →
                </Link>
              }
            >
              <p>
                <span className="text-zinc-500">Vigência:</span> {c.vigenciaInicio} — {c.vigenciaFim}
              </p>
              <p>
                <span className="text-zinc-500">Condição:</span> {c.condicaoResumo}
              </p>
              <p className="text-xs text-zinc-500">
                SLA: gate-in≤{c.sla.gateInMaxH}h · dwell≈{c.sla.dwellMedEsperadoH}h · throughput gate monitorado via performance
              </p>
              <p className="font-mono text-[10px] text-zinc-600">SHA-256 {c.fingerprint.slice(0, 18)}…</p>
            </ContractCard>
          ))
        )}
      </div>
    </div>
  );
}

function refreshStatus(c: AdminContract): AdminContract {
  return { ...c, status: contractStatusFromDates(c.vigenciaFim) };
}
