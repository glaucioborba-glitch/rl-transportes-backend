"use client";

import { useEffect, useState } from "react";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import type { ServicoInterno } from "@/lib/admin/types";
import { readJson, writeJson, adminServicosKey } from "@/lib/admin/storage";
import { ContractCard } from "@/components/admin/contract-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function AdminServicosPage() {
  const allowed = useStaffAuthStore((s) => s.user?.role === "ADMIN" || s.user?.role === "GERENTE");
  const [items, setItems] = useState<ServicoInterno[]>([]);

  useEffect(() => {
    setItems(readJson<ServicoInterno[]>(adminServicosKey(), []));
  }, []);

  function persist(next: ServicoInterno[]) {
    setItems(next);
    writeJson(adminServicosKey(), next);
  }

  function advance(s: ServicoInterno) {
    const order = ["aberto", "andamento", "concluído"] as const;
    const i = order.indexOf(s.status as (typeof order)[number]);
    const nextStatus = i < 2 ? order[i + 1]! : s.status;
    persist(items.map((x) => (x.id === s.id ? { ...x, status: nextStatus as ServicoInterno["status"] } : x)));
  }

  if (!allowed) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold text-white">Serviços internos</h1>
        <p className="text-sm text-zinc-500">TI · Manutenção (não pátio) · Compras — fluxo simples.</p>
      </div>
      <Button
        type="button"
        className="bg-emerald-600 hover:bg-emerald-500"
        onClick={() =>
          persist([
            ...items,
            {
              id: `srv-${Date.now()}`,
              categoria: "TI",
              descricao: "Nova solicitação",
              criticidade: "média",
              responsavel: "Service Desk",
              status: "aberto",
              createdAt: new Date().toISOString(),
            },
          ])
        }
      >
        Abrir chamado
      </Button>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((s) => (
          <ContractCard
            key={s.id}
            title={`${s.categoria}`}
            subtitle={s.status}
            footer={
              <Button type="button" variant="outline" size="sm" className="border-zinc-600" onClick={() => advance(s)}>
                Avançar status
              </Button>
            }
          >
            <p>{s.descricao}</p>
            <p className="text-xs text-zinc-500">Responsável: {s.responsavel}</p>
            <p className={cn("text-xs font-bold uppercase", s.criticidade === "alta" && "text-red-400")}>{s.criticidade}</p>
          </ContractCard>
        ))}
      </div>
    </div>
  );
}
