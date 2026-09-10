"use client";

import { FinanceiroBreadcrumb, FinanceiroTabs } from "../../components/financeiro-tabs";
import { TabelaAluguelForm } from "../components/tabela-aluguel-form";

export default function NovaTabelaAluguelPage() {
  return (
    <div className="space-y-6">
      <FinanceiroBreadcrumb current="Nova tabela de aluguel" />
      <FinanceiroTabs />
      <TabelaAluguelForm />
    </div>
  );
}
