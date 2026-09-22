import { UnidadeAluguelForm } from "../components/unidade-aluguel-form";

export default function EditarUnidadeAluguelPage({ params }: { params: { id: string } }) {
  return <UnidadeAluguelForm unidadeId={params.id} />;
}
