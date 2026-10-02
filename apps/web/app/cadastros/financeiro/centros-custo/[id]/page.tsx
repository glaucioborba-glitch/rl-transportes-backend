import { FinanceiroBreadcrumb, FinanceiroTabs } from "../../components/financeiro-tabs";
import { CentroCustoForm } from "../components/centro-custo-form";

type Props = { params: { id: string } };

export default function EditarCentroCustoPage({ params }: Props) {
  return (
    <div className="space-y-6">
      <FinanceiroBreadcrumb current="Editar Centro de Custo" />
      <FinanceiroTabs />
      <div>
        <h1 className="text-2xl font-bold">Editar Centro de Custo</h1>
      </div>
      <CentroCustoForm centroId={params.id} />
    </div>
  );
}
