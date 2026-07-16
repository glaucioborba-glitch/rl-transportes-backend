import { Settings } from "lucide-react";
import { CadastrosBlocoPlaceholder } from "@/components/cadastros/cadastros-bloco-placeholder";

export default function ParametrosPage() {
  return (
    <CadastrosBlocoPlaceholder
      title="Parâmetros do Sistema"
      description="Parâmetros gerais, Feriados, SLA, Configurações de Pátio"
      tabs={["Parâmetros Gerais", "Feriados", "SLA", "Configurações de Pátio"]}
      placeholderMessage="Parâmetros do Sistema serão implementados no próximo PR."
      icon={Settings}
    />
  );
}
