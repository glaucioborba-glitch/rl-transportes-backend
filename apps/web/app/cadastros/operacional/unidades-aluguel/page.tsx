"use client";

import { useRouter } from "next/navigation";
import { Container, Edit2, Plus } from "lucide-react";
import { OperacionalBreadcrumb, OperacionalTabs } from "../components/operacional-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWidgetData, WidgetError } from "@/components/ui/widget-error";
import { listCadastrosUnidadesAluguel } from "@/lib/api/cadastros-unidades-aluguel-client";
import { canDo } from "@/lib/cadastros/permission-matrix";
import { useStaffAuthStore } from "@/stores/staff-auth-store";

const STATUS_LABEL: Record<string, string> = {
  DISPONIVEL: "Disponível",
  ALUGADA: "Alugada",
  MANUTENCAO: "Manutenção",
  INATIVA: "Inativa",
};

export default function UnidadesAluguelPage() {
  const router = useRouter();
  const staffUser = useStaffAuthStore((s) => s.user);
  const user = {
    id: staffUser?.id,
    role: staffUser?.role ?? "",
    permissions: staffUser?.permissions,
  };
  const { data, loading, error, refetch } = useWidgetData(() => listCadastrosUnidadesAluguel(), []);
  const canCreate = canDo(user, "operacional", "CREATE");
  const canEdit = canDo(user, "operacional", "EDIT");
  const unidades = data?.items ?? [];

  return (
    <div className="space-y-6">
      <OperacionalBreadcrumb current="Unidades de aluguel" />
      <OperacionalTabs />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Unidades de aluguel</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Frota exclusiva. O contrato (ID de aluguel) sai em Pátio → Aluguéis. Hospedar no pátio é outro ID, pelo Gate.
          </p>
        </div>
        {canCreate ? (
          <Button
            variant="default"
            size="sm"
            onClick={() => router.push("/cadastros/operacional/unidades-aluguel/novo")}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova unidade
          </Button>
        ) : null}
      </div>

      {loading ? <div className="h-64 animate-pulse rounded-lg border border-border bg-card" /> : null}
      {!loading && error ? (
        <WidgetError title="Não foi possível carregar a frota" onRetry={refetch} />
      ) : null}

      {!loading && !error && unidades.length === 0 ? (
        <div className="flex h-[30vh] flex-col items-center justify-center gap-2 rounded-lg border border-dashed">
          <Container className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Nenhuma unidade cadastrada na frota de aluguel.</p>
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                <th className="px-4 py-3">ISO</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Tam.</th>
                <th className="px-4 py-3">Situação</th>
                <th className="px-4 py-3">Contrato</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {unidades.map((u) => (
                <tr key={u.id} className="border-b border-border/60">
                  <td className="px-4 py-3 font-medium">{u.unidadeIso}</td>
                  <td className="px-4 py-3">{u.tipoContainerCodigo}</td>
                  <td className="px-4 py-3">{u.containerTamanho}</td>
                  <td className="px-4 py-3">
                    <Badge variant={u.status === "DISPONIVEL" ? "default" : "secondary"}>
                      {STATUS_LABEL[u.status] ?? u.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {u.aluguelAtivo
                      ? `${u.aluguelAtivo.clienteNome} · ID ${u.aluguelAtivo.numero}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canEdit && u.status !== "ALUGADA" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/cadastros/operacional/unidades-aluguel/${u.id}`)}
                      >
                        <Edit2 className="mr-2 h-4 w-4" />
                        Editar
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
