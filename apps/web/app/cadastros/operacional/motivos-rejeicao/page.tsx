"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Bell, Edit2, MessageSquare, Plus } from "lucide-react";
import { OperacionalBreadcrumb, OperacionalTabs } from "../components/operacional-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWidgetData, WidgetError } from "@/components/ui/widget-error";
import {
  listCadastrosMotivosRejeicao,
  type CadastroMotivoRejeicao,
} from "@/lib/api/cadastros-motivos-rejeicao-client";
import { canDo } from "@/lib/cadastros/permission-matrix";
import { useStaffAuthStore } from "@/stores/staff-auth-store";

const TIPO_FILTERS = [
  { value: "todos", label: "Todos" },
  { value: "REJEICAO_GATE", label: "Rejeição Gate" },
  { value: "RETORNO_PATIO", label: "Retorno Pátio" },
  { value: "CANCELAMENTO_CLIENTE", label: "Cancelamento" },
] as const;

const TIPO_LABELS: Record<string, string> = {
  REJEICAO_GATE: "Rejeição no Gate",
  RETORNO_PATIO: "Retorno ao Pátio",
  CANCELAMENTO_CLIENTE: "Cancelamento do Cliente",
};

function LoadingSkeleton() {
  return <div className="h-64 animate-pulse rounded-lg border border-border bg-card" />;
}

function groupByTipo(motivos: CadastroMotivoRejeicao[]) {
  const groups = new Map<string, CadastroMotivoRejeicao[]>();
  for (const m of motivos) {
    const list = groups.get(m.tipo) ?? [];
    list.push(m);
    groups.set(m.tipo, list);
  }
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
}

export default function MotivosRejeicaoListPage() {
  const router = useRouter();
  const staffUser = useStaffAuthStore((s) => s.user);
  const user = {
    id: staffUser?.id,
    role: staffUser?.role ?? "",
    permissions: staffUser?.permissions,
  };

  const [filterTipo, setFilterTipo] = useState<(typeof TIPO_FILTERS)[number]["value"]>("todos");

  const { data, loading, error, refetch } = useWidgetData(
    () => listCadastrosMotivosRejeicao(filterTipo === "todos" ? undefined : filterTipo),
    [filterTipo],
  );

  const canCreate = canDo(user, "operacional", "CREATE");
  const canEdit = canDo(user, "operacional", "EDIT");
  const motivos = data?.items ?? [];

  const grouped = useMemo(() => groupByTipo(motivos), [motivos]);

  return (
    <div className="space-y-6">
      <OperacionalBreadcrumb current="Motivos de Rejeição" />
      <OperacionalTabs />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Motivos de Rejeição</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Catálogo de motivos para gate, retorno ao pátio e cancelamentos
          </p>
        </div>
        {canCreate ? (
          <Button
            variant="default"
            size="sm"
            onClick={() => router.push("/cadastros/operacional/motivos-rejeicao/novo")}
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo Motivo
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1">
        {TIPO_FILTERS.map((f) => (
          <Button
            key={f.value}
            variant={filterTipo === f.value ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterTipo(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {loading ? <LoadingSkeleton /> : null}
      {!loading && error ? (
        <WidgetError title="Não foi possível carregar motivos de rejeição" onRetry={refetch} />
      ) : null}

      {!loading && !error && motivos.length === 0 ? (
        <div className="flex h-[40vh] flex-col items-center justify-center gap-3">
          <Ban className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-lg text-muted-foreground">Nenhum motivo cadastrado.</p>
        </div>
      ) : null}

      {!loading && !error && motivos.length > 0 ? (
        <div className="space-y-6">
          {grouped.map(([tipo, items]) => (
            <div key={tipo} className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="border-b border-border bg-muted/20 px-4 py-3">
                <h2 className="text-sm font-bold">{TIPO_LABELS[tipo] ?? tipo}</h2>
                <p className="text-xs text-muted-foreground">{items.length} motivo(s)</p>
              </div>
              <table className="w-full">
                <thead className="border-b border-border">
                  <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="p-4 text-left">Código</th>
                    <th className="p-4 text-left">Descrição</th>
                    <th className="p-4 text-center">Observação</th>
                    <th className="p-4 text-center">Notifica</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((motivo) => (
                    <tr
                      key={motivo.id}
                      className="border-b border-border/50 hover:bg-muted/20"
                    >
                      <td className="p-4">
                        <span className="font-mono font-bold text-[var(--accent)]">
                          {motivo.codigo}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm">{motivo.descricao}</span>
                      </td>
                      <td className="p-4 text-center">
                        {motivo.exigeObservacao ? (
                          <MessageSquare className="mx-auto h-4 w-4 text-amber-400" />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        {motivo.notificaCliente ? (
                          <Bell className="mx-auto h-4 w-4 text-blue-400" />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <Badge
                          variant="neutral"
                          className={
                            motivo.ativo
                              ? "border-green-500/30 bg-green-500/15 text-green-400"
                              : "border-red-500/30 bg-red-500/15 text-red-400"
                          }
                        >
                          {motivo.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </td>
                      <td className="p-4 text-center">
                        {canEdit ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              router.push(
                                `/cadastros/operacional/motivos-rejeicao/${motivo.id}`,
                              )
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
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
