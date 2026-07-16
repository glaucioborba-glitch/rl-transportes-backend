"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Plus, Search } from "lucide-react";
import { ClienteCard } from "./components/cliente-card";
import { ClientesEmptyState, ClientesSkeleton } from "@/components/cadastros/clientes-list-ui";
import { PaginationSimple } from "@/components/cadastros/pagination-simple";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWidgetData, WidgetError } from "@/components/ui/widget-error";
import {
  inativarCadastrosCliente,
  listCadastrosClientes,
} from "@/lib/api/cadastros-clientes-client";
import { ApiError } from "@/lib/api/staff-client";
import { canDo } from "@/lib/cadastros/permission-matrix";
import { toast } from "@/lib/toast";
import { useStaffAuthStore } from "@/stores/staff-auth-store";

export default function ClientesListPage() {
  const router = useRouter();
  const staffUser = useStaffAuthStore((s) => s.user);
  const user = {
    id: staffUser?.id,
    role: staffUser?.role ?? "",
    permissions: staffUser?.permissions,
  };

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"todos" | "ativos" | "inativos">("ativos");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterStatus]);

  const { data, loading, error, refetch } = useWidgetData(
    () =>
      listCadastrosClientes({
        search: debouncedSearch,
        status: filterStatus,
        page,
      }),
    [debouncedSearch, filterStatus, page],
  );

  const canCreate = canDo(user, "pessoas", "CREATE");
  const canEdit = canDo(user, "pessoas", "EDIT");
  const canDelete = canDo(user, "pessoas", "DELETE");

  const clientes = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 10;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  async function handleInativar(id: string) {
    if (!window.confirm("Inativar este cliente? O histórico será preservado.")) return;
    try {
      await inativarCadastrosCliente(id);
      toast.success("Cliente inativado.");
      refetch();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro ao inativar cliente.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/cadastros/pessoas" className="hover:text-white">
              Pessoas & Entidades
            </Link>
            <span>/</span>
            <span>Clientes</span>
          </div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total} cliente(s) cadastrado(s) · Fonte única de dados mestres
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
              onClick={() => router.push("/cadastros/pessoas/clientes/novo")}
            >
              <Plus className="mr-2 h-4 w-4" />
              Novo Cliente
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por CNPJ, razão social, nome fantasia..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-1">
          {(["ativos", "inativos", "todos"] as const).map((status) => (
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
      </div>

      {loading ? <ClientesSkeleton /> : null}
      {!loading && error ? (
        <WidgetError title="Não foi possível carregar clientes" onRetry={refetch} />
      ) : null}
      {!loading && !error && clientes.length === 0 ? <ClientesEmptyState /> : null}
      {!loading && !error && clientes.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {clientes.map((cliente) => (
            <ClienteCard
              key={cliente.id}
              cliente={cliente}
              canEdit={canEdit}
              canDelete={canDelete}
              onEdit={() => router.push(`/cadastros/pessoas/clientes/${cliente.id}`)}
              onAuditoria={() =>
                router.push(`/cadastros/pessoas/clientes/${cliente.id}/auditoria`)
              }
              onInativar={() => void handleInativar(cliente.id)}
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
