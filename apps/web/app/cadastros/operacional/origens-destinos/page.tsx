"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Edit2, MapPin, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWidgetData, WidgetError } from "@/components/ui/widget-error";
import {
  labelTipoLocalTransporte,
  listCadastrosLocaisTransporte,
} from "@/lib/api/cadastros-locais-transporte-client";
import { canDo } from "@/lib/cadastros/permission-matrix";
import { useStaffAuthStore } from "@/stores/staff-auth-store";

function LoadingSkeleton() {
  return <div className="h-64 animate-pulse rounded-lg border border-border bg-card" />;
}

export default function OrigensDestinosListPage() {
  const router = useRouter();
  const staffUser = useStaffAuthStore((s) => s.user);
  const user = {
    id: staffUser?.id,
    role: staffUser?.role ?? "",
    permissions: staffUser?.permissions,
  };

  const [search, setSearch] = useState("");

  const { data, loading, error, refetch } = useWidgetData(
    () => listCadastrosLocaisTransporte(search),
    [search],
  );

  const canCreate = canDo(user, "operacional", "CREATE");
  const canEdit = canDo(user, "operacional", "EDIT");
  const locais = useMemo(() => data?.items ?? [], [data?.items]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Origens e destinos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pontos de partida e chegada das tarifas. Também aparecem no mapa de Localização; o Fretes vai
            usar esta lista para designar o destino.
          </p>
        </div>
        {canCreate ? (
          <Button
            variant="default"
            size="sm"
            onClick={() => router.push("/cadastros/operacional/origens-destinos/novo")}
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo local
          </Button>
        ) : null}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por código, nome ou cidade..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? <LoadingSkeleton /> : null}
      {!loading && error ? (
        <WidgetError title="Não foi possível carregar origens/destinos" onRetry={refetch} />
      ) : null}

      {!loading && !error ? (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full">
            <thead className="border-b border-border">
              <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                <th className="p-4 text-left">Código</th>
                <th className="p-4 text-left">Nome</th>
                <th className="p-4 text-left">Tipo</th>
                <th className="p-4 text-left">Cidade</th>
                <th className="p-4 text-center">Mapa</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {locais.map((local) => (
                <tr key={local.id} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="p-4">
                    <span className="font-mono font-bold text-[var(--accent)]">{local.codigo}</span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{local.nome}</span>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">
                    {labelTipoLocalTransporte(local.tipo)}
                  </td>
                  <td className="p-4 text-sm">
                    {local.cidade ? `${local.cidade}${local.uf ? `/${local.uf}` : ""}` : "—"}
                  </td>
                  <td className="p-4 text-center text-xs text-muted-foreground">
                    {local.lat != null && local.lng != null ? "Com ponto" : "Sem ponto"}
                  </td>
                  <td className="p-4 text-center">
                    <Badge
                      variant="neutral"
                      className={
                        local.ativo
                          ? "border-green-500/30 bg-green-500/15 text-green-400"
                          : "border-red-500/30 bg-red-500/15 text-red-400"
                      }
                    >
                      {local.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </td>
                  <td className="p-4 text-center">
                    {canEdit ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          router.push(`/cadastros/operacional/origens-destinos/${local.id}`)
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
          {locais.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Nenhum local cadastrado. Cadastre origens e destinos antes das tarifas de transporte.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
