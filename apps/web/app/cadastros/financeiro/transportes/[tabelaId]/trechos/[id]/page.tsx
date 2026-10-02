import { TarifaTransporteForm } from "../../../components/tarifa-transporte-form";
import { FinanceiroBreadcrumb, FinanceiroTabs } from "../../../../components/financeiro-tabs";

type Props = { params: { tabelaId: string; id: string } };

export default function EditarTrechoTransportePage({ params }: Props) {
  return (
    <div className="space-y-6">
      <FinanceiroBreadcrumb current="Editar trecho" />
      <FinanceiroTabs />
      <TarifaTransporteForm tabelaId={params.tabelaId} tarifaId={params.id} />
    </div>
  );
}
