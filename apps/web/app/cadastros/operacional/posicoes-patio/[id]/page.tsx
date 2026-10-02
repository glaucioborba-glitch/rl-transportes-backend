import { PosicaoForm } from "../components/posicao-form";

export default function EditarPosicaoPage({ params }: { params: { id: string } }) {
  return <PosicaoForm posicaoId={params.id} />;
}
