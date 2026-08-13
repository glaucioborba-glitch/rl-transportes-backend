"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Plus, Search } from "lucide-react";
import { ColaboradorCard } from "./components/colaborador-card";
import {
  ColaboradoresEmptyState,
  ColaboradoresSkeleton,
} from "@/components/cadastros/colaboradores-list-ui";
import { PaginationSimple } from "@/components/cadastros/pagination-simple";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWidgetData, WidgetError } from "@/components/ui/widget-error";
import { listCadastrosColaboradores } from "@/lib/api/cadastros-colaboradores-client";
import { canDo } from "@/lib/cadastros/permission-matrix";
import { useStaffAuthStore } from "@/stores/staff-auth-store";

const SELECT_CLASS =
  "flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm";

export default function ColaboradoresListPage() {
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
    "todos" | "ativos" | "inativos" | "afastados"
  >("ativos");
  const [filterVinculo, setFilterVinculo] = useState("todos");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterStatus, filterVinculo]);

  const { data, loading, error, refetch } = useWidgetData(
    () =>
      listCadastrosColaboradores({
        search: debouncedSearch,
        status: filterStatus,
        vinculo: filterVinculo,
        page,
      }),
    [debouncedSearch, filterStatus, filterVinculo, page],
  );

  const canCreate = canDo(user, "pessoas", "CREATE");
  const canEdit = canDo(user, "pessoas", "EDIT");

  const colaboradores = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 10;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/cadastros/pessoas" className="hover:text-white">
              Pessoas & Entidades
            </Link>
            <span>/</span>
            <span>Colaboradores</span>
          </div>
          <h1 className="text-2xl font-bold">Colaboradores</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total} colaborador(es) cadastrado(s) · Fonte única para RH, Gate e Financeiro
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled>
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          {canCreate ? (
            <Button
              variant="default"
              size="sm"
              onClick={() => router.push("/cadastros/pessoas/colaboradores/novo")}
            >
              <Plus className="mr-2 h-4 w-4" />
              Novo Colaborador
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, CPF, matrícula..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {(["ativos", "afastados", "inativos", "todos"] as const).map((status) => (
            <Button
              key={status}
              variant={filterStatus === status ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus(status)}
              className="capitalize"
            >
              {status}
            </Button>
          ))}
        </div>
        <select
          value={filterVinculo}
          onChange={(e) => setFilterVinculo(e.target.value)}
          className={SELECT_CLASS}
        >
          <option value="todos">Todos os vínculos</option>
          <option value="CLT">CLT</option>
          <option value="TERCEIRIZADO">Terceirizado</option>
          <option value="ESTAGIARIO">Estagiário</option>
          <option value="TEMPORARIO">Temporário</option>
          <option value="PRESTADOR">Prestador PJ</option>
        </select>
      </div>

      {loading ? <ColaboradoresSkeleton /> : null}
      {!loading && error ? (
        <WidgetError title="Não foi possível carregar colaboradores" onRetry={refetch} />
      ) : null}
      {!loading && !error && colaboradores.length === 0 ? <ColaboradoresEmptyState /> : null}
      {!loading && !error && colaboradores.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {colaboradores.map((colab) => (
            <ColaboradorCard
              key={colab.id}
              colab={colab}
              canEdit={canEdit}
              onEdit={() => router.push(`/cadastros/pessoas/colaboradores/${colab.id}`)}
              onAuditoria={() =>
                router.push(`/cadastros/pessoas/colaboradores/${colab.id}/auditoria`)
              }
            />
          ))}
        </div>
      ) : null}

      {!loading && !error && total > pageSize ? (
        <PaginationSimple page={page} total={totalPages} onChange={setPage} />
      ) : null}
    </div>
  );
}
