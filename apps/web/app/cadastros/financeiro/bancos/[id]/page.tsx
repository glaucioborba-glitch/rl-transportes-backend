import { BancoForm } from "../components/banco-form";
import { FinanceiroBreadcrumb, FinanceiroTabs } from "../../components/financeiro-tabs";

type Props = { params: { id: string } };

export default function EditarBancoPage({ params }: Props) {
  return (
    <div className="space-y-6">
      <FinanceiroBreadcrumb current="Editar Banco" />
      <FinanceiroTabs />
      <BancoForm bancoId={params.id} />
    </div>
  );
}
