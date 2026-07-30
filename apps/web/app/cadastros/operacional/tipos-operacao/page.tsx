"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  Clock,
  Cog,
  Edit2,
  Plus,
  Search,
} from "lucide-react";
import { OperacionalBreadcrumb, OperacionalTabs } from "../components/operacional-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWidgetData, WidgetError } from "@/components/ui/widget-error";
import { listCadastrosTiposOperacao } from "@/lib/api/cadastros-tipos-operacao-client";
import { canDo } from "@/lib/cadastros/permission-matrix";
import { useStaffAuthStore } from "@/stores/staff-auth-store";

function LoadingSkeleton() {
  return <div className="h-64 animate-pulse rounded-lg border border-border bg-card" />;
}

function DirecaoIcon({ direcao }: { direcao: string }) {
  if (direcao === "ENTRADA") {
    return (
      <span title="Entrada" className="inline-flex items-center gap-1 text-green-400">
        <ArrowDownToLine className="h-4 w-4" />
        <span className="text-xs font-medium">Entrada</span>
      </span>
    );
  }
  if (direcao === "SAIDA") {
    return (
      <span title="Saída" className="inline-flex items-center gap-1 text-purple-400">
        <ArrowUpFromLine className="h-4 w-4" />
        <span className="text-xs font-medium">Saída</span>
      </span>
    );
  }
  if (direcao === "INTERNA") {
    return (
      <span title="Interna" className="inline-flex items-center gap-1 text-blue-400">
        <ArrowLeftRight className="h-4 w-4" />
        <span className="text-xs font-medium">Interna</span>
      </span>
    );
  }
  return <span className="text-muted-foreground">{direcao}</span>;
}

export default function TiposOperacaoListPage() {
  const router = useRouter();
  const staffUser = useStaffAuthStore((s) => s.user);
  const user = {
    id: staffUser?.id,
    role: staffUser?.role ?? "",
    permissions: staffUser?.permissions,
  };

  const [search, setSearch] = useState("");

  const { data, loading, error, refetch } = useWidgetData(
    () => listCadastrosTiposOperacao(),
    [],
  );

  const canCreate = canDo(user, "operacional", "CREATE");
  const canEdit = canDo(user, "operacional", "EDIT");

  const tipos = useMemo(() => {
    const items = data?.items ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (t) =>
        t.codigo.toLowerCase().includes(q) ||
        t.nome.toLowerCase().includes(q) ||
        t.direcao.toLowerCase().includes(q),
    );
  }, [data?.items, search]);

  return (
    <div className="space-y-6">
      <OperacionalBreadcrumb current="Tipos de Operação" />
      <OperacionalTabs />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Tipos de Operação</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Catálogo de operações do terminal · Baixa, coleta, transferência e inspeções
          </p>
        </div>
        {canCreate ? (
          <Button
            variant="default"
            size="sm"
            onClick={() => router.push("/cadastros/operacional/tipos-operacao/novo")}
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo Tipo
          </Button>
        ) : null}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por código, nome ou direção..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? <LoadingSkeleton /> : null}
      {!loading && error ? (
        <WidgetError title="Não foi possível carregar tipos de operação" onRetry={refetch} />
      ) : null}

      {!loading && !error ? (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full">
            <thead className="border-b border-border">
              <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                <th className="p-4 text-left">Código</th>
                <th className="p-4 text-left">Nome</th>
                <th className="p-4 text-left">Direção</th>
                <th className="p-4 text-left">Requisitos</th>
                <th className="p-4 text-center">Tempo</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {tipos.map((tipo) => (
                <tr key={tipo.id} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: tipo.cor }}
                      />
                      <span className="font-mono font-bold text-[var(--accent)]">
                        {tipo.codigo}
                      </span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <Cog className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{tipo.nome}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <DirecaoIcon direcao={tipo.direcao} />
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      {tipo.exigeContainer ? (
                        <Badge variant="neutral" className="text-xs">
                          Contêiner
                        </Badge>
                      ) : null}
                      {tipo.exigeCaminhao ? (
                        <Badge variant="neutral" className="text-xs">
                          Caminhão
                        </Badge>
                      ) : null}
                      {tipo.exigeEmpilhadeira ? (
                        <Badge variant="neutral" className="text-xs">
                          Empilhadeira
                        </Badge>
                      ) : null}
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    {tipo.tempoPadrao != null ? (
                      <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {tipo.tempoPadrao} min
                      </span>
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
                          router.push(`/cadastros/operacional/tipos-operacao/${tipo.id}`)
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
              Nenhum tipo de operação cadastrado.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
