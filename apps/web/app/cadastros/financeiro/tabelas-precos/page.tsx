"use client";

import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Calendar,
  DollarSign,
  Edit2,
  FileText,
  Plus,
} from "lucide-react";
import { FinanceiroBreadcrumb, FinanceiroTabs } from "../components/financeiro-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWidgetData, WidgetError } from "@/components/ui/widget-error";
import { listCadastrosTabelasPrecos } from "@/lib/api/cadastros-tabelas-precos-client";
import { formatDate } from "@/lib/cadastros/formatters";
import { canDo } from "@/lib/cadastros/permission-matrix";
import { useStaffAuthStore } from "@/stores/staff-auth-store";

function LoadingSkeleton() {
  return <div className="h-64 animate-pulse rounded-lg border border-border bg-card" />;
}

export default function TabelasPrecosPage() {
  const router = useRouter();
  const staffUser = useStaffAuthStore((s) => s.user);
  const user = {
    id: staffUser?.id,
    role: staffUser?.role ?? "",
    permissions: staffUser?.permissions,
  };

  const { data, loading, error, refetch } = useWidgetData(() => listCadastrosTabelasPrecos(), []);

  const canCreate = canDo(user, "financeiro", "CREATE");
  const canEdit = canDo(user, "financeiro", "EDIT");

  const tabelas = data?.items ?? [];
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  return (
    <div className="space-y-6">
      <FinanceiroBreadcrumb current="Tabelas de Preços" />
      <FinanceiroTabs />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Tabelas de Preços</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pricing por tipo de operação × tipo de contêiner · Vigência com validade
          </p>
        </div>
        {canCreate ? (
          <Button
            variant="default"
            size="sm"
            onClick={() => router.push("/cadastros/financeiro/tabelas-precos/novo")}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova Tabela
          </Button>
        ) : null}
      </div>

      {loading ? <LoadingSkeleton /> : null}
      {!loading && error ? (
        <WidgetError title="Não foi possível carregar tabelas de preços" onRetry={refetch} />
      ) : null}

      {!loading && !error ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {tabelas.map((tabela) => {
            const inicio = tabela.dataInicio ? new Date(tabela.dataInicio) : null;
            const fim = tabela.dataFim ? new Date(tabela.dataFim) : null;
            if (inicio) inicio.setHours(0, 0, 0, 0);
            if (fim) fim.setHours(0, 0, 0, 0);

            const vigente =
              inicio &&
              inicio <= hoje &&
              (!fim || fim >= hoje);
            const expirada = fim && fim < hoje;
            const futura = inicio && inicio > hoje;

            return (
              <div
                key={tabela.id}
                className={`flex flex-col gap-3 rounded-lg border bg-card p-5 ${
                  vigente
                    ? "border-green-500/30"
                    : expirada
                      ? "border-red-500/30 opacity-60"
                      : "border-amber-500/30"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--accent)]/10">
                      <DollarSign className="h-5 w-5 text-[var(--accent)]" />
                    </div>
                    <div>
                      <p className="text-base font-bold">{tabela.nome}</p>
                      <p className="text-sm text-muted-foreground">{tabela.descricao || "—"}</p>
                    </div>
                  </div>
                  <Badge
                    variant="neutral"
                    className={
                      vigente
                        ? "border-green-500/30 bg-green-500/15 text-green-400"
                        : expirada
                          ? "border-red-500/30 bg-red-500/15 text-red-400"
                          : "border-amber-500/30 bg-amber-500/15 text-amber-400"
                    }
                  >
                    {vigente ? "Vigente" : expirada ? "Expirada" : futura ? "Futura" : "—"}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Vigência</p>
                    <p className="flex items-center gap-1 font-medium">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      {formatDate(tabela.dataInicio)} →{" "}
                      {tabela.dataFim ? formatDate(tabela.dataFim) : "Indefinido"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Itens</p>
                    <p className="flex items-center gap-1 font-medium">
                      <FileText className="h-3 w-3 text-muted-foreground" />
                      {tabela.itensCount ?? 0} item(ns)
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Cliente</p>
                    <p className="font-medium">{tabela.cliente?.nome ?? "Tabela geral"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Moeda</p>
                    <p className="font-medium">{tabela.moeda || "BRL"}</p>
                  </div>
                </div>

                {expirada ? (
                  <div className="flex items-center gap-1 rounded bg-red-500/10 px-2 py-1 text-xs text-red-400">
                    <AlertTriangle className="h-3 w-3" />
                    Tabela expirada — operações usam a vigente
                  </div>
                ) : null}

                {canEdit ? (
                  <div className="mt-2 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        router.push(`/cadastros/financeiro/tabelas-precos/${tabela.id}`)
                      }
                    >
                      <Edit2 className="mr-1 h-3 w-3" />
                      Editar / Ver Itens
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })}
          {tabelas.length === 0 ? (
            <p className="col-span-full p-8 text-center text-sm text-muted-foreground">
              Nenhuma tabela de preços cadastrada.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
