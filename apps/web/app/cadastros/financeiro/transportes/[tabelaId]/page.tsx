"use client";

import { FinanceiroBreadcrumb, FinanceiroTabs } from "../../components/financeiro-tabs";
import { TabelaTransporteForm } from "../components/tabela-transporte-form";
import { TrechosTabela } from "../components/trechos-tabela";
import { canDo } from "@/lib/cadastros/permission-matrix";
import { useStaffAuthStore } from "@/stores/staff-auth-store";

type Props = { params: { tabelaId: string } };

export default function EditarTabelaTransportePage({ params }: Props) {
  const staffUser = useStaffAuthStore((s) => s.user);
  const user = {
    id: staffUser?.id,
    role: staffUser?.role ?? "",
    permissions: staffUser?.permissions,
  };
  const canCreate = canDo(user, "financeiro", "CREATE");
  const canEdit = canDo(user, "financeiro", "EDIT");
  const canDelete = canDo(user, "financeiro", "DELETE") || canEdit;

  return (
    <div className="space-y-8">
      <FinanceiroBreadcrumb current="Editar tabela de transportes" />
      <FinanceiroTabs />
      <div>
        <h1 className="text-2xl font-bold">Editar tabela de transportes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Parâmetros da tabela e trechos desta negociação.
        </p>
      </div>
      <TabelaTransporteForm tabelaId={params.tabelaId} />
      <TrechosTabela
        tabelaId={params.tabelaId}
        canCreate={canCreate}
        canEdit={canEdit}
        canDelete={canDelete}
      />
    </div>
  );
}
