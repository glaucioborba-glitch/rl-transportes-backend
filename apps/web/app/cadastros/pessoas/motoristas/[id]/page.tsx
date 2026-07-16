import Link from "next/link";
import { MotoristaForm } from "../components/motorista-form";

type Props = {
  params: { id: string };
};

export default function EditarMotoristaPage({ params }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/cadastros/pessoas" className="hover:text-white">
            Pessoas & Entidades
          </Link>
          <span>/</span>
          <Link href="/cadastros/pessoas/motoristas" className="hover:text-white">
            Motoristas
          </Link>
          <span>/</span>
          <span>Editar</span>
        </div>
        <h1 className="text-2xl font-bold">Editar Motorista</h1>
      </div>
      <MotoristaForm motoristaId={params.id} />
    </div>
  );
}
