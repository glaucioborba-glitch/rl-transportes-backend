"use client";

import { useSearchParams } from "next/navigation";
import { FinanceiroBreadcrumb, FinanceiroTabs } from "../../components/financeiro-tabs";
import { TabelaTransporteForm } from "../components/tabela-transporte-form";

export default function NovaTabelaTransportePage() {
  const duplicarId = useSearchParams().get("duplicar") ?? undefined;
  return (
    <div className="space-y-6">
      <FinanceiroBreadcrumb
        current={duplicarId ? "Duplicar tabela de transportes" : "Nova tabela de transportes"}
      />
      <FinanceiroTabs />
      <div>
        <h1 className="text-2xl font-bold">
          {duplicarId ? "Duplicar tabela de transportes" : "Nova tabela de transportes"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {duplicarId
            ? "Os trechos já vêm copiados. Altere só o que for diferente e salve."
            : "Nomeie a tabela e, em seguida, cadastre os trechos da negociação."}
        </p>
      </div>
      <TabelaTransporteForm duplicarId={duplicarId} />
    </div>
  );
}
