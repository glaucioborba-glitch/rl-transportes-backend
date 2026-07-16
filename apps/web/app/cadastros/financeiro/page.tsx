import { DollarSign } from "lucide-react";
import { CadastrosBlocoPlaceholder } from "@/components/cadastros/cadastros-bloco-placeholder";

export default function FinanceiroCadastrosPage() {
  return (
    <CadastrosBlocoPlaceholder
      title="Financeiro"
      description="Bancos, Centros de Custo, Plano de Contas, Tabelas de Preços"
      tabs={["Bancos", "Centros de Custo", "Plano de Contas", "Tabelas de Preços"]}
      placeholderMessage="Cadastros Financeiros serão implementados no próximo PR."
      icon={DollarSign}
    />
  );
}
