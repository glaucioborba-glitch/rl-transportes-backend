"use client";

import { useSearchParams } from "next/navigation";
import { FinanceiroBreadcrumb, FinanceiroTabs } from "../../components/financeiro-tabs";
import { TabelaAluguelForm } from "../components/tabela-aluguel-form";

export default function NovaTabelaAluguelPage() {
  const duplicarId = useSearchParams().get("duplicar") ?? undefined;
  return (
    <div className="space-y-6">
      <FinanceiroBreadcrumb current={duplicarId ? "Clonar tabela de aluguel" : "Nova tabela de aluguel"} />
      <FinanceiroTabs />
      <TabelaAluguelForm duplicarId={duplicarId} />
    </div>
  );
}
