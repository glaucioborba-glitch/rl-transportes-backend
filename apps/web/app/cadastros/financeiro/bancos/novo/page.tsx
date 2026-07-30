"use client";

import { BancoForm } from "../components/banco-form";
import { FinanceiroBreadcrumb, FinanceiroTabs } from "../../components/financeiro-tabs";

export default function NovoBancoPage() {
  return (
    <div className="space-y-6">
      <FinanceiroBreadcrumb current="Novo Banco" />
      <FinanceiroTabs />
      <BancoForm />
    </div>
  );
}
