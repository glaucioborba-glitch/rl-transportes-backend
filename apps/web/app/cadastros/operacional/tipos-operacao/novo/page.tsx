import Link from "next/link";
import { TipoOperacaoForm } from "../components/tipo-operacao-form";

export default function NovoTipoOperacaoPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/cadastros/operacional" className="hover:text-white">
            Operacional
          </Link>
          <span>/</span>
          <Link href="/cadastros/operacional/tipos-operacao" className="hover:text-white">
            Tipos de Operação
          </Link>
          <span>/</span>
          <span>Novo</span>
        </div>
        <h1 className="text-2xl font-bold">Novo Tipo de Operação</h1>
      </div>
      <TipoOperacaoForm />
    </div>
  );
}
