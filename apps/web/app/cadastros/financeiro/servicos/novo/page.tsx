"use client";

import { FinanceiroBreadcrumb, FinanceiroTabs } from "../../components/financeiro-tabs";
import { TabelaServicoForm } from "../components/tabela-servico-form";

export default function NovaTabelaServicoPage() {
  return (
    <div className="space-y-6">
      <FinanceiroBreadcrumb current="Nova tabela de serviços" />
      <FinanceiroTabs />
      <TabelaServicoForm />
    </div>
  );
}
