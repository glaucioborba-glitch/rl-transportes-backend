import { FinanceiroBreadcrumb, FinanceiroTabs } from "../../components/financeiro-tabs";
import { TabelaPrecoForm } from "../components/tabela-preco-form";

type Props = { params: { id: string } };

export default function EditarTabelaPrecoPage({ params }: Props) {
  return (
    <div className="space-y-6">
      <FinanceiroBreadcrumb current="Editar Tabela de Preços" />
      <FinanceiroTabs />
      <div>
        <h1 className="text-2xl font-bold">Editar Tabela de Preços</h1>
      </div>
      <TabelaPrecoForm tabelaId={params.id} />
    </div>
  );
}
