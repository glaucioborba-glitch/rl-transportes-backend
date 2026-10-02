import { LocalTransporteForm } from "../components/local-transporte-form";

type Props = { params: { id: string } };

export default function EditarLocalTransportePage({ params }: Props) {
  return <LocalTransporteForm localId={params.id} />;
}
