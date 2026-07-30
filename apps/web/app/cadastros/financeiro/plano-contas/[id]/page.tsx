import { FinanceiroBreadcrumb, FinanceiroTabs } from "../../components/financeiro-tabs";
import { PlanoContasForm } from "../components/plano-contas-form";

type Props = { params: { id: string } };

export default function EditarContaPage({ params }: Props) {
  return (
    <div className="space-y-6">
      <FinanceiroBreadcrumb current="Editar Conta" />
      <FinanceiroTabs />
      <div>
        <h1 className="text-2xl font-bold">Editar Conta</h1>
      </div>
      <PlanoContasForm contaId={params.id} />
    </div>
  );
}
