"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import type { LegalProcess } from "@/lib/admin/types";
import { readJson, writeJson, adminLegalKey } from "@/lib/admin/storage";
import { ContractCard } from "@/components/admin/contract-card";
import { Button } from "@/components/ui/button";

const SEED: LegalProcess[] = [
  {
    id: "lp-demo-1",
    clienteId: "",
    clienteNome: "Cliente exemplo",
    tipo: "contratual",
    status: "analisando",
    classificacao: "Revisão cláusula SLA",
    criticidade: "média",
    createdAt: new Date().toISOString(),
  },
];

export default function AdminJuridicoPage() {
  const allowed = useStaffAuthStore((s) => s.user?.role === "ADMIN" || s.user?.role === "GERENTE");
  const [items, setItems] = useState<LegalProcess[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [classif, setClassif] = useState("");
  const [crit, setCrit] = useState<"" | LegalProcess["criticidade"]>("");

  useEffect(() => {
    const raw = readJson<LegalProcess[]>(adminLegalKey(), []);
    setItems(raw.length ? raw : SEED);
  }, []);

  function persist(next: LegalProcess[]) {
    setItems(next);
    writeJson(adminLegalKey(), next);
  }

  const filtered = useMemo(() => {
    return items.filter((p) => {
      if (clienteId && p.clienteId !== clienteId) return false;
      if (classif && !p.classificacao.toLowerCase().includes(classif.toLowerCase())) return false;
      if (crit && p.criticidade !== crit) return false;
      return true;
    });
  }, [items, clienteId, classif, crit]);

  if (!allowed) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-white">Jurídico</h1>
          <p className="text-sm text-zinc-500">Processos internos · apenas armazenamento local.</p>
        </div>
        <Link href="/admin/juridico/riscos" className="text-sm font-semibold text-sky-400 hover:underline">
          Painel de riscos →
        </Link>
      </div>
      <ContractCard title="Filtros" subtitle="Compliance">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs text-zinc-500">
            clienteId
            <input className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-2 py-2 font-mono text-xs" value={clienteId} onChange={(e) => setClienteId(e.target.value.trim())} />
          </label>
          <label className="text-xs text-zinc-500">
            Classificação
            <input className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-2 py-2 text-sm" value={classif} onChange={(e) => setClassif(e.target.value)} />
          </label>
          <label className="text-xs text-zinc-500">
            Criticidade
            <select className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-2 py-2 text-sm" value={crit} onChange={(e) => setCrit(e.target.value as typeof crit)}>
              <option value="">todas</option>
              <option value="baixa">baixa</option>
              <option value="média">média</option>
              <option value="alta">alta</option>
            </select>
          </label>
        </div>
      </ContractCard>
      <Button
        type="button"
        variant="outline"
        className="border-zinc-600"
        onClick={() =>
          persist([
            ...items,
            {
              id: `lp-${Date.now()}`,
              clienteId: clienteId || "—",
              clienteNome: "Novo processo",
              tipo: "contratual",
              status: "aberto",
              classificacao: "Triagem",
              criticidade: "baixa",
              createdAt: new Date().toISOString(),
            },
          ])
        }
      >
        Novo processo (local)
      </Button>
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="min-w-[720px] w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-zinc-900/90 text-xs uppercase text-zinc-500">
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Criticidade</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-b border-white/5">
                <td className="px-3 py-2">{p.clienteNome}</td>
                <td className="px-3 py-2">{p.tipo}</td>
                <td className="px-3 py-2 text-sky-300">{p.status}</td>
                <td className="px-3 py-2">{p.criticidade}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
