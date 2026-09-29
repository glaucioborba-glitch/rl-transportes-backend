"use client";

import { useRouter } from "next/navigation";
import { Edit2, Plus, Wrench } from "lucide-react";
import { FinanceiroBreadcrumb, FinanceiroTabs } from "../components/financeiro-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWidgetData, WidgetError } from "@/components/ui/widget-error";
import { listCadastrosTabelasServicos } from "@/lib/api/cadastros-tabelas-servicos-client";
import { canDo } from "@/lib/cadastros/permission-matrix";
import { useStaffAuthStore } from "@/stores/staff-auth-store";

export default function ServicosCadastroPage() {
  const router = useRouter();
  const staffUser = useStaffAuthStore((s) => s.user);
  const user = {
    id: staffUser?.id,
    role: staffUser?.role ?? "",
    permissions: staffUser?.permissions,
  };
  const { data, loading, error, refetch } = useWidgetData(() => listCadastrosTabelasServicos(), []);
  const canCreate = canDo(user, "financeiro", "CREATE");
  const canEdit = canDo(user, "financeiro", "EDIT");
  const tabelas = data?.items ?? [];

  return (
    <div className="space-y-6">
      <FinanceiroBreadcrumb current="Serviços" />
      <FinanceiroTabs />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Serviços adicionais</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Valores lançáveis no ID (inspeção, reparo, lavagem, lacre, pesagem…). Entram na mesma fatura do pátio. Qual
            tabela vale para cada cliente é definida em{" "}
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
            onClick={() => router.push("/cadastros/financeiro/servicos/novo")}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova tabela
          </Button>
        ) : null}
      </div>

      {loading ? <div className="h-64 animate-pulse rounded-lg border border-border bg-card" /> : null}
      {!loading && error ? (
        <WidgetError title="Não foi possível carregar serviços" onRetry={refetch} />
      ) : null}

      {!loading && !error && tabelas.length === 0 ? (
        <div className="flex h-[30vh] flex-col items-center justify-center gap-2 rounded-lg border border-dashed">
          <Wrench className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Nenhuma tabela ainda. Crie a tabela padrão do terminal.</p>
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {tabelas.map((t) => (
            <div key={t.id} className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{t.nome}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{t.qtdItens} serviço(s)</p>
                </div>
                <div className="flex gap-2">
                  {t.padrao ? <Badge>Padrão</Badge> : null}
                  {t.ativo ? null : <Badge variant="neutral">Inativa</Badge>}
                </div>
              </div>
              {canEdit ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => router.push(`/cadastros/financeiro/servicos/${t.id}`)}
                >
                  <Edit2 className="mr-2 h-4 w-4" />
                  Editar
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
