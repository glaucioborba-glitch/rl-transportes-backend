import Link from "next/link";
import { PessoasTabs } from "../../components/pessoas-tabs";
import { TerceiroForm } from "../components/terceiro-form";

type Props = { params: { id: string } };

export default function EditarTerceiroPage({ params }: Props) {
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
          <span>Editar</span>
        </div>
        <h1 className="text-2xl font-bold">Editar terceiro</h1>
      </div>
      <PessoasTabs />
      <TerceiroForm terceiroId={params.id} />
    </div>
  );
}
