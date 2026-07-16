"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Forklift, Plus, Search } from "lucide-react";
import { EquipamentoCard } from "./components/equipamento-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWidgetData, WidgetError } from "@/components/ui/widget-error";
import { listCadastrosEquipamentos } from "@/lib/api/cadastros-equipamentos-client";
import { canDo } from "@/lib/cadastros/permission-matrix";
import { useStaffAuthStore } from "@/stores/staff-auth-store";

function EquipamentosSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-56 animate-pulse rounded-lg border border-border bg-card" />
      ))}
    </div>
  );
}

export default function EquipamentosListPage() {
  const router = useRouter();
  const staffUser = useStaffAuthStore((s) => s.user);
  const user = {
    id: staffUser?.id,
    role: staffUser?.role ?? "",
    permissions: staffUser?.permissions,
  };

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<
    "todos" | "disponiveis" | "em_uso" | "manutencao" | "inativos"
  >("todos");

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  const { data, loading, error, refetch } = useWidgetData(
    () =>
      listCadastrosEquipamentos({
        search: debouncedSearch,
        status: filterStatus,
      }),
    [debouncedSearch, filterStatus],
  );

  const canCreate = canDo(user, "operacional", "CREATE");
  const canEdit = canDo(user, "operacional", "EDIT");
  const equipamentos = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/cadastros/operacional" className="hover:text-white">
              Operacional
            </Link>
            <span>/</span>
            <span>Equipamentos</span>
          </div>
          <h1 className="text-2xl font-bold">Equipamentos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Empilhadeiras, Reach Stackers e RTGs · Vínculo com operador feito no login
          </p>
        </div>
        {canCreate ? (
          <Button
            variant="default"
            size="sm"
            onClick={() => router.push("/cadastros/operacional/equipamentos/novo")}
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo Equipamento
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por código, marca, modelo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {(["todos", "disponiveis", "em_uso", "manutencao", "inativos"] as const).map(
            (status) => (
              <Button
                key={status}
                variant={filterStatus === status ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterStatus(status)}
                className="capitalize"
              >
                {status.replace(/_/g, " ")}
              </Button>
            ),
          )}
        </div>
      </div>

      {loading ? <EquipamentosSkeleton /> : null}
      {!loading && error ? (
        <WidgetError title="Não foi possível carregar equipamentos" onRetry={refetch} />
      ) : null}
      {!loading && !error && equipamentos.length === 0 ? (
        <div className="flex h-[40vh] flex-col items-center justify-center gap-3">
          <Forklift className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-lg text-muted-foreground">Nenhum equipamento cadastrado.</p>
        </div>
      ) : null}
      {!loading && !error && equipamentos.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {equipamentos.map((eq) => (
            <EquipamentoCard
              key={eq.id}
              equip={eq}
              canEdit={canEdit}
              onEdit={() => router.push(`/cadastros/operacional/equipamentos/${eq.id}`)}
              onAuditoria={() =>
                router.push(`/cadastros/operacional/equipamentos/${eq.id}/auditoria`)
              }
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
