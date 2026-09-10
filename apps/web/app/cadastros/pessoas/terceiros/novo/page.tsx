import Link from "next/link";
import { PessoasTabs } from "../../components/pessoas-tabs";
import { TerceiroForm } from "../components/terceiro-form";

export default function NovoTerceiroPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/cadastros/pessoas" className="hover:text-white">
            Pessoas & Entidades
          </Link>
          <span>/</span>
          <Link href="/cadastros/pessoas/terceiros" className="hover:text-white">
            Terceiros
          </Link>
          <span>/</span>
          <span>Novo</span>
        </div>
        <h1 className="text-2xl font-bold">Novo terceiro</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Obrigatório: motorista e cavalo. Dados de pagamento, carretas e documentos são opcionais.
        </p>
      </div>
      <PessoasTabs />
      <TerceiroForm />
    </div>
  );
}
