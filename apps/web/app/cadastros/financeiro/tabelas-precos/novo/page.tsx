"use client";

import { useSearchParams } from "next/navigation";
import { FinanceiroBreadcrumb, FinanceiroTabs } from "../../components/financeiro-tabs";
import { TabelaPrecoForm } from "../components/tabela-preco-form";

export default function NovaTabelaPrecoPage() {
  const duplicarId = useSearchParams().get("duplicar") ?? undefined;
  return (
    <div className="space-y-6">
      <FinanceiroBreadcrumb current={duplicarId ? "Duplicar tabela de preços" : "Nova Tabela de Preços"} />
      <FinanceiroTabs />
      <div>
        <h1 className="text-2xl font-bold">
          {duplicarId ? "Duplicar tabela de preços" : "Nova Tabela de Preços"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {duplicarId
            ? "Matriz e operações já vêm preenchidas. Altere só o que for diferente e salve."
            : "Pricing por tipo de operação × tipo de contêiner"}
        </p>
      </div>
      <TabelaPrecoForm duplicarId={duplicarId} />
    </div>
  );
}
