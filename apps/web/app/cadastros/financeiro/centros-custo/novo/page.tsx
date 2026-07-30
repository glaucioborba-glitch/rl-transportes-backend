"use client";

import { FinanceiroBreadcrumb, FinanceiroTabs } from "../../components/financeiro-tabs";
import { CentroCustoForm } from "../components/centro-custo-form";

export default function NovoCentroCustoPage() {
  return (
    <div className="space-y-6">
      <FinanceiroBreadcrumb current="Novo Centro de Custo" />
      <FinanceiroTabs />
      <div>
        <h1 className="text-2xl font-bold">Novo Centro de Custo</h1>
        <p className="mt-1 text-sm text-muted-foreground">Estrutura hierárquica de custos operacionais</p>
      </div>
      <CentroCustoForm />
    </div>
  );
}
