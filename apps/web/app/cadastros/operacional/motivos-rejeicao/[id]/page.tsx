import Link from "next/link";
import { MotivoRejeicaoForm } from "../components/motivo-rejeicao-form";

type Props = {
  params: { id: string };
};

export default function EditarMotivoRejeicaoPage({ params }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/cadastros/operacional" className="hover:text-white">
            Operacional
          </Link>
          <span>/</span>
          <Link href="/cadastros/operacional/motivos-rejeicao" className="hover:text-white">
            Motivos de Rejeição
          </Link>
          <span>/</span>
          <span>Editar</span>
        </div>
        <h1 className="text-2xl font-bold">Editar Motivo de Rejeição</h1>
      </div>
      <MotivoRejeicaoForm motivoId={params.id} />
    </div>
  );
}
