"use client";

import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Calendar,
  Copy,
  Edit2,
  FileText,
  Plus,
  Route,
} from "lucide-react";
import { FinanceiroBreadcrumb, FinanceiroTabs } from "../components/financeiro-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWidgetData, WidgetError } from "@/components/ui/widget-error";
import { listCadastrosTabelasTransporte } from "@/lib/api/cadastros-tabelas-transporte-client";
import { formatDate } from "@/lib/cadastros/formatters";
import { canDo } from "@/lib/cadastros/permission-matrix";
import { useStaffAuthStore } from "@/stores/staff-auth-store";

function LoadingSkeleton() {
  return <div className="h-64 animate-pulse rounded-lg border border-border bg-card" />;
}

export default function TabelasTransportePage() {
  const router = useRouter();
  const staffUser = useStaffAuthStore((s) => s.user);
  const user = {
    id: staffUser?.id,
    role: staffUser?.role ?? "",
    permissions: staffUser?.permissions,
  };

  const { data, loading, error, refetch } = useWidgetData(
    () => listCadastrosTabelasTransporte(),
    [],
  );

  const canCreate = canDo(user, "financeiro", "CREATE");
  const canEdit = canDo(user, "financeiro", "EDIT");
  const tabelas = data?.items ?? [];
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  return (
    <div className="space-y-6">
      <FinanceiroBreadcrumb current="Tabela de transportes" />
      <FinanceiroTabs />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Tabela de transportes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Catálogo de trechos e tarifas por negociação. Qual tabela vale para cada cliente é definida em{" "}
            <a href="/financeiro/condicoes-clientes" className="text-primary underline-offset-2 hover:underline">
              Financeiro → Forma e prazo
            </a>
            .
          </p>
        </div>
        {canCreate ? (
          <Button
            variant="default"
            size="sm"
            onClick={() => router.push("/cadastros/financeiro/transportes/novo")}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova tabela
          </Button>
        ) : null}
      </div>

      {loading ? <LoadingSkeleton /> : null}
      {!loading && error ? (
        <WidgetError title="Não foi possível carregar tabelas de transportes" onRetry={refetch} />
      ) : null}

      {!loading && !error ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {tabelas.map((tabela) => {
            const inicio = tabela.dataInicio ? new Date(tabela.dataInicio) : null;
            const fim = tabela.dataFim ? new Date(tabela.dataFim) : null;
            if (inicio) inicio.setHours(0, 0, 0, 0);
            if (fim) fim.setHours(0, 0, 0, 0);

            const vigente = inicio && inicio <= hoje && (!fim || fim >= hoje);
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
                      <Route className="h-5 w-5 text-[var(--accent)]" />
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
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Trechos</p>
                    <p className="flex items-center gap-1 font-medium">
                      <FileText className="h-3 w-3 text-muted-foreground" />
                      {tabela.itensCount ?? 0} trecho(s)
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Uso</p>
                    <p className="font-medium">{tabela.padrao ? "Padrão do terminal" : "Catálogo"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Status</p>
                    <p className="font-medium">{tabela.ativo ? "Ativa" : "Inativa"}</p>
                  </div>
                </div>

                {expirada ? (
                  <div className="flex items-center gap-1 rounded bg-red-500/10 px-2 py-1 text-xs text-red-400">
                    <AlertTriangle className="h-3 w-3" />
                    Tabela expirada — novos cadastros usam a vigente
                  </div>
                ) : null}

                {canEdit || canCreate ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {canEdit ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/cadastros/financeiro/transportes/${tabela.id}`)}
                      >
                        <Edit2 className="mr-1 h-3 w-3" />
                        Editar / Ver trechos
                      </Button>
                    ) : null}
                    {canCreate ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          router.push(
                            `/cadastros/financeiro/transportes/novo?duplicar=${encodeURIComponent(tabela.id)}`,
                          )
                        }
                      >
                        <Copy className="mr-1 h-3 w-3" />
                        Duplicar tabela
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
          {tabelas.length === 0 ? (
            <p className="col-span-full p-8 text-center text-sm text-muted-foreground">
              Nenhuma tabela de transportes cadastrada.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
