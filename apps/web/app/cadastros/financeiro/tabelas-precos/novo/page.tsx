"use client";

import { FinanceiroBreadcrumb, FinanceiroTabs } from "../../components/financeiro-tabs";
import { TabelaPrecoForm } from "../components/tabela-preco-form";

export default function NovaTabelaPrecoPage() {
  return (
    <div className="space-y-6">
      <FinanceiroBreadcrumb current="Nova Tabela de Preços" />
      <FinanceiroTabs />
      <div>
        <h1 className="text-2xl font-bold">Nova Tabela de Preços</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pricing por tipo de operação × tipo de contêiner
        </p>
      </div>
      <TabelaPrecoForm />
    </div>
  );
}
