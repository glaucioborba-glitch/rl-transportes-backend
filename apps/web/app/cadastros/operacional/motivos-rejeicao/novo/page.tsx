import { MotivoRejeicaoForm } from "../components/motivo-rejeicao-form";

export default function NovoMotivoRejeicaoPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Novo Motivo de Rejeição</h1>
      <MotivoRejeicaoForm />
    </div>
  );
}
