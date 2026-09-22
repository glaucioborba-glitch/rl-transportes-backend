import { EquipamentoForm } from "../components/equipamento-form";

type Props = {
  params: { id: string };
};

export default function EditarEquipamentoPage({ params }: Props) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Editar Equipamento</h1>
      <EquipamentoForm equipamentoId={params.id} />
    </div>
  );
}
