"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Plus, Search } from "lucide-react";
import { TransportadoraCard } from "./components/transportadora-card";
import {
  TransportadorasEmptyState,
  TransportadorasSkeleton,
} from "@/components/cadastros/transportadoras-list-ui";
import { PaginationSimple } from "@/components/cadastros/pagination-simple";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWidgetData, WidgetError } from "@/components/ui/widget-error";
import { listCadastrosTransportadoras } from "@/lib/api/cadastros-transportadoras-client";
import { canDo } from "@/lib/cadastros/permission-matrix";
import { useStaffAuthStore } from "@/stores/staff-auth-store";

export default function TransportadorasListPage() {
  const router = useRouter();
  const staffUser = useStaffAuthStore((s) => s.user);
  const user = {
    id: staffUser?.id,
    role: staffUser?.role ?? "",
    permissions: staffUser?.permissions,
  };

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"todos" | "ativas" | "inativas">("ativas");
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
      listCadastrosTransportadoras({
        search: debouncedSearch,
        status: filterStatus,
        page,
      }),
    [debouncedSearch, filterStatus, page],
  );

  const canCreate = canDo(user, "pessoas", "CREATE");
  const canEdit = canDo(user, "pessoas", "EDIT");

  const transportadoras = data?.items ?? [];
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
            <span>Transportadoras</span>
          </div>
          <h1 className="text-2xl font-bold">Transportadoras</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total} transportadora(s) cadastrada(s) · Fonte única para Gate CPO e Dispatch
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
              onClick={() => router.push("/cadastros/pessoas/transportadoras/novo")}
            >
              <Plus className="mr-2 h-4 w-4" />
              Nova Transportadora
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por CNPJ, razão social, RNTRC..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {(["ativas", "inativas", "todos"] as const).map((status) => (
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

      {loading ? <TransportadorasSkeleton /> : null}
      {!loading && error ? (
        <WidgetError title="Não foi possível carregar transportadoras" onRetry={refetch} />
      ) : null}
      {!loading && !error && transportadoras.length === 0 ? <TransportadorasEmptyState /> : null}
      {!loading && !error && transportadoras.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {transportadoras.map((transp) => (
            <TransportadoraCard
              key={transp.id}
              transp={transp}
              canEdit={canEdit}
              onEdit={() => router.push(`/cadastros/pessoas/transportadoras/${transp.id}`)}
              onAuditoria={() =>
                router.push(`/cadastros/pessoas/transportadoras/${transp.id}/auditoria`)
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
