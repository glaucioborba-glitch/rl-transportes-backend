"use client";

import { FinanceiroBreadcrumb, FinanceiroTabs } from "../../components/financeiro-tabs";
import { TabelaAluguelForm } from "../components/tabela-aluguel-form";

export default function TabelaAluguelPage({ params }: { params: { id: string } }) {
  return (
    <div className="space-y-6">
      <FinanceiroBreadcrumb current="Tabela de aluguel" />
      <FinanceiroTabs />
      <TabelaAluguelForm tabelaId={params.id} />
    </div>
  );
}
