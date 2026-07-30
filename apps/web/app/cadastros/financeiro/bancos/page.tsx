"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building, CreditCard, Edit2, Plus, Search } from "lucide-react";
import { FinanceiroBreadcrumb, FinanceiroTabs } from "../components/financeiro-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWidgetData, WidgetError } from "@/components/ui/widget-error";
import { listCadastrosBancos } from "@/lib/api/cadastros-bancos-client";
import { formatCNPJ } from "@/lib/cadastros/formatters";
import { canDo } from "@/lib/cadastros/permission-matrix";
import { useStaffAuthStore } from "@/stores/staff-auth-store";

function LoadingSkeleton() {
  return <div className="h-64 animate-pulse rounded-lg border border-border bg-card" />;
}

export default function BancosListPage() {
  const router = useRouter();
  const staffUser = useStaffAuthStore((s) => s.user);
  const user = {
    id: staffUser?.id,
    role: staffUser?.role ?? "",
    permissions: staffUser?.permissions,
  };

  const [search, setSearch] = useState("");

  const { data, loading, error, refetch } = useWidgetData(
    () => listCadastrosBancos(search),
    [search],
  );

  const canCreate = canDo(user, "financeiro", "CREATE");
  const canEdit = canDo(user, "financeiro", "EDIT");

  const bancos = useMemo(() => data?.items ?? [], [data?.items]);

  return (
    <div className="space-y-6">
      <FinanceiroBreadcrumb current="Bancos" />
      <FinanceiroTabs />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Bancos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Catálogo de instituições financeiras · Contas para recebimento e pagamento
          </p>
        </div>
        {canCreate ? (
          <Button
            variant="default"
            size="sm"
            onClick={() => router.push("/cadastros/financeiro/bancos/novo")}
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo Banco
          </Button>
        ) : null}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por código, nome ou CNPJ..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? <LoadingSkeleton /> : null}
      {!loading && error ? (
        <WidgetError title="Não foi possível carregar bancos" onRetry={refetch} />
      ) : null}

      {!loading && !error ? (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full">
            <thead className="border-b border-border">
              <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                <th className="p-4 text-left">Código</th>
                <th className="p-4 text-left">Nome</th>
                <th className="p-4 text-left">CNPJ</th>
                <th className="p-4 text-center">Contas Vinculadas</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {bancos.map((banco) => (
                <tr key={banco.id} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="p-4">
                    <span className="font-mono font-bold text-[var(--accent)]">{banco.codigo}</span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{banco.nome}</span>
                    </div>
                  </td>
                  <td className="p-4 font-mono text-sm tabular-nums">
                    {banco.cnpj ? formatCNPJ(banco.cnpj) : "—"}
                  </td>
                  <td className="p-4 text-center">
                    <span className="inline-flex items-center justify-center gap-1 text-sm">
                      <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                      {banco.contasVinculadas ?? 0}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <Badge
                      variant="neutral"
                      className={
                        banco.ativo
                          ? "border-green-500/30 bg-green-500/15 text-green-400"
                          : "border-red-500/30 bg-red-500/15 text-red-400"
                      }
                    >
                      {banco.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </td>
                  <td className="p-4 text-center">
                    {canEdit ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/cadastros/financeiro/bancos/${banco.id}`)}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {bancos.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Nenhum banco cadastrado.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
