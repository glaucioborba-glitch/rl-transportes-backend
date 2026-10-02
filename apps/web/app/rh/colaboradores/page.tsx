"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { ColaboradorCard } from "@/app/cadastros/pessoas/colaboradores/components/colaborador-card";
import {
  ColaboradoresEmptyState,
  ColaboradoresSkeleton,
} from "@/components/cadastros/colaboradores-list-ui";
import { PaginationSimple } from "@/components/cadastros/pagination-simple";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWidgetData, WidgetError } from "@/components/ui/widget-error";
import { listCadastrosColaboradores } from "@/lib/api/cadastros-colaboradores-client";
import { isIntranetGestorRole } from "@/lib/intranet/intranet-path-access";
import { useStaffAuthStore } from "@/stores/staff-auth-store";

const SELECT_CLASS =
  "flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm";

const BASE = "/rh/colaboradores";

export default function RhColaboradoresListPage() {
  const router = useRouter();
  const staffUser = useStaffAuthStore((s) => s.user);
  const allowed = isIntranetGestorRole(staffUser?.role);

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

  const colaboradores = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 10;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (!allowed) {
    return <p className="text-center text-amber-400">Acesso restrito.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/rh" className="hover:text-white">
              RH
            </Link>
            <span>/</span>
            <span>Colaboradores</span>
          </div>
          <h1 className="text-2xl font-bold">Colaboradores</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total} colaborador(es) · Cadastro da equipe, turno, perfil e senha da intranet
          </p>
        </div>
        <Button variant="default" size="sm" onClick={() => router.push(`${BASE}/novo`)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Colaborador
        </Button>
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
              canEdit
              onEdit={() => router.push(`${BASE}/${colab.id}`)}
              onAuditoria={() => router.push(`${BASE}/${colab.id}/auditoria`)}
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
