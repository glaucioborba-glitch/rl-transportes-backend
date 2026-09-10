"use client";

import { useSearchParams } from "next/navigation";
import { TarifaTransporteForm } from "../../components/tarifa-transporte-form";
import { FinanceiroBreadcrumb, FinanceiroTabs } from "../../../components/financeiro-tabs";

type Props = { params: { tabelaId: string } };

export default function NovoTrechoTransportePage({ params }: Props) {
  const duplicarId = useSearchParams().get("duplicar") ?? undefined;
  return (
    <div className="space-y-6">
      <FinanceiroBreadcrumb current={duplicarId ? "Duplicar trecho" : "Novo trecho"} />
      <FinanceiroTabs />
      <TarifaTransporteForm tabelaId={params.tabelaId} duplicarId={duplicarId} />
    </div>
  );
}
