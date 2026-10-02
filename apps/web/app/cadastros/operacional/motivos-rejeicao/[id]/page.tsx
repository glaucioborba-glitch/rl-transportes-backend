import { MotivoRejeicaoForm } from "../components/motivo-rejeicao-form";

type Props = {
  params: { id: string };
};

export default function EditarMotivoRejeicaoPage({ params }: Props) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Editar Motivo de Rejeição</h1>
      <MotivoRejeicaoForm motivoId={params.id} />
    </div>
  );
}
