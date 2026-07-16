import Link from "next/link";
import { TipoContainerForm } from "../../components/tipo-container-form";

export default function NovoTipoContainerPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/cadastros/operacional" className="hover:text-white">
            Operacional
          </Link>
          <span>/</span>
          <Link href="/cadastros/operacional/tipos-container" className="hover:text-white">
            Tipos de Contêiner
          </Link>
          <span>/</span>
          <span>Novo</span>
        </div>
        <h1 className="text-2xl font-bold">Novo Tipo de Contêiner</h1>
      </div>
      <TipoContainerForm />
    </div>
  );
}
