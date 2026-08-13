"use client";

import { FinanceiroBreadcrumb, FinanceiroTabs } from "../../components/financeiro-tabs";
import { PlanoContasForm } from "../components/plano-contas-form";

export default function NovaContaPage() {
  return (
    <div className="space-y-6">
      <FinanceiroBreadcrumb current="Nova Conta" />
      <FinanceiroTabs />
      <div>
        <h1 className="text-2xl font-bold">Nova Conta</h1>
        <p className="mt-1 text-sm text-muted-foreground">Plano de contas contábil</p>
      </div>
      <PlanoContasForm />
    </div>
  );
}
