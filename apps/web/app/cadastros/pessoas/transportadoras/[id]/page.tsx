import Link from "next/link";
import { TransportadoraForm } from "../components/transportadora-form";

type Props = {
  params: { id: string };
};

export default function EditarTransportadoraPage({ params }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/cadastros/pessoas" className="hover:text-white">
            Pessoas & Entidades
          </Link>
          <span>/</span>
          <Link href="/cadastros/pessoas/transportadoras" className="hover:text-white">
            Transportadoras
          </Link>
          <span>/</span>
          <span>Editar</span>
        </div>
        <h1 className="text-2xl font-bold">Editar Transportadora</h1>
      </div>
      <TransportadoraForm transportadoraId={params.id} />
    </div>
  );
}
