"use client";

import { useEffect, useMemo, useState } from "react";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import type { SlaInternoTicket } from "@/lib/admin/types";
import { readJson, writeJson, adminSlaInternoKey } from "@/lib/admin/storage";
import { ContractCard } from "@/components/admin/contract-card";
import { SlaGauge } from "@/components/admin/sla-gauge";
import { Button } from "@/components/ui/button";

function pctResolved(tickets: SlaInternoTicket[], alvo: number) {
  const done = tickets.filter((t) => t.resolvidoEm);
  if (!done.length) return 85;
  let ok = 0;
  for (const t of done) {
    const a = new Date(t.abertoEm).getTime();
    const r = new Date(t.resolvidoEm!).getTime();
    const h = (r - a) / 36e5;
    if (h <= alvo) ok++;
  }
  return Math.round((ok / done.length) * 100);
}

export default function AdminSlaInternoPage() {
  const allowed = useStaffAuthStore((s) => s.user?.role === "ADMIN" || s.user?.role === "GERENTE");
  const [tickets, setTickets] = useState<SlaInternoTicket[]>([]);

  useEffect(() => {
    let t = readJson<SlaInternoTicket[]>(adminSlaInternoKey(), []);
    if (t.length === 0) {
      t = [
        { id: "1", categoria: "TI — incidente", abertoEm: new Date(Date.now() - 864e5 * 2).toISOString(), resolvidoEm: new Date().toISOString(), alvoHoras: 24 },
        { id: "2", categoria: "Compras — cotação", abertoEm: new Date(Date.now() - 864e5).toISOString(), alvoHoras: 72 },
      ];
      writeJson(adminSlaInternoKey(), t);
    }
    setTickets(t);
  }, []);

  const byCat = useMemo(() => {
    const m = new Map<string, SlaInternoTicket[]>();
    for (const t of tickets) {
      const k = t.categoria.split(" —")[0] ?? t.categoria;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(t);
    }
    return Array.from(m.entries());
  }, [tickets]);

  if (!allowed) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold text-white">SLA interno</h1>
        <p className="text-sm text-zinc-500">Metas simuladas · abertura e resolução de chamados.</p>
      </div>
      <Button
        type="button"
        variant="outline"
        className="border-zinc-600"
        onClick={() => {
          const next = [
            ...tickets,
            {
              id: `t-${Date.now()}`,
              categoria: "TI — requisição",
              abertoEm: new Date().toISOString(),
              alvoHoras: 8,
            },
          ];
          setTickets(next);
          writeJson(adminSlaInternoKey(), next);
        }}
      >
        Novo ticket modelo
      </Button>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {byCat.map(([cat, list]) => {
          const alvo = list[0]?.alvoHoras ?? 24;
          return (
            <SlaGauge
              key={cat}
              value={pctResolved(list, alvo)}
              label={cat}
              hint={`Alvo médio ${alvo}h`}
            />
          );
        })}
      </div>
      <ContractCard title="Backlog" subtitle="Tickets locais">
        <ul className="space-y-2 text-sm">
          {tickets.map((t) => (
            <li key={t.id} className="flex flex-wrap justify-between gap-2 rounded-lg border border-white/5 px-3 py-2">
              <span>{t.categoria}</span>
              <span className="text-zinc-500">{t.resolvidoEm ? "resolvido" : "aberto"}</span>
            </li>
          ))}
        </ul>
      </ContractCard>
    </div>
  );
}
