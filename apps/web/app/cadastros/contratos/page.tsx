import { FileText } from "lucide-react";
import { CadastrosBlocoPlaceholder } from "@/components/cadastros/cadastros-bloco-placeholder";

export default function ContratosPage() {
  return (
    <CadastrosBlocoPlaceholder
      title="Contratos & Documentos"
      description="Contratos, Aditivos, Tipos de Documentos, Templates"
      tabs={["Contratos", "Aditivos", "Tipos de Documentos", "Templates"]}
      placeholderMessage="Cadastros de Contratos & Documentos serão implementados no próximo PR."
      icon={FileText}
    />
  );
}
