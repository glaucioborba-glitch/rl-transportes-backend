"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Box, Edit2, Package, Plus, Search, Snowflake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useWidgetData, WidgetError } from "@/components/ui/widget-error";
import { listCadastrosTiposContainer } from "@/lib/api/cadastros-tipos-container-client";
import {
  formatTamanhoContainerDisplay,
  normalizeTamanhosContainer,
} from "@/lib/cadastros/tipo-container-tamanhos";
import { canDo } from "@/lib/cadastros/permission-matrix";
import { useStaffAuthStore } from "@/stores/staff-auth-store";

function LoadingSkeleton() {
  return <div className="h-64 animate-pulse rounded-lg border border-border bg-card" />;
}

function TipoIcon({ codigo }: { codigo: string }) {
  if (codigo === "REEFER") return <Snowflake className="h-4 w-4 text-blue-400" />;
  if (codigo === "DRY") return <Package className="h-4 w-4 text-muted-foreground" />;
  if (codigo === "HC") return <Box className="h-4 w-4 text-muted-foreground" />;
  return null;
}

export default function TiposContainerListPage() {
  const router = useRouter();
  const staffUser = useStaffAuthStore((s) => s.user);
  const user = {
    id: staffUser?.id,
    role: staffUser?.role ?? "",
    permissions: staffUser?.permissions,
  };

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  const { data, loading, error, refetch } = useWidgetData(
    () => listCadastrosTiposContainer(debouncedSearch),
    [debouncedSearch],
  );

  const canCreate = canDo(user, "operacional", "CREATE");
  const canEdit = canDo(user, "operacional", "EDIT");
  const tipos = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/cadastros/operacional" className="hover:text-white">
              Operacional
            </Link>
            <span>/</span>
            <span>Tipos de Contêiner</span>
          </div>
          <h1 className="text-2xl font-bold">Tipos de Contêiner</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Catálogo de tipos aceitos pelo terminal · Dropdown para o cliente no agendamento
          </p>
        </div>
        {canCreate ? (
          <Button
            variant="default"
            size="sm"
            onClick={() => router.push("/cadastros/operacional/tipos-container/novo")}
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo Tipo
          </Button>
        ) : null}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por código ou nome..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? <LoadingSkeleton /> : null}
      {!loading && error ? (
        <WidgetError title="Não foi possível carregar tipos" onRetry={refetch} />
      ) : null}

      {!loading && !error ? (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full">
            <thead className="border-b border-border">
              <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                <th className="p-4 text-left">Código</th>
                <th className="p-4 text-left">Nome</th>
                <th className="p-4 text-left">Tamanhos</th>
                <th className="p-4 text-center">Tomada Reefer</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {tipos.map((tipo) => (
                <tr key={tipo.id} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="p-4">
                    <span className="font-mono font-bold text-[var(--accent)]">{tipo.codigo}</span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <TipoIcon codigo={tipo.codigo} />
                      <span className="font-medium">{tipo.nome}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      {normalizeTamanhosContainer(tipo.tamanhos).map((tam) => (
                        <Badge key={tam} variant="neutral" className="text-xs">
                          {formatTamanhoContainerDisplay(tam)}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    {tipo.tomadaReefer ? (
                      <Snowflake className="mx-auto h-4 w-4 text-blue-400" />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    <Badge
                      variant="neutral"
                      className={
                        tipo.ativo
                          ? "border-green-500/30 bg-green-500/15 text-green-400"
                          : "border-red-500/30 bg-red-500/15 text-red-400"
                      }
                    >
                      {tipo.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </td>
                  <td className="p-4 text-center">
                    {canEdit ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          router.push(`/cadastros/operacional/tipos-container/${tipo.id}`)
                        }
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {tipos.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Nenhum tipo cadastrado.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
