import { LocalTransporteForm } from "../components/local-transporte-form";
import { OperacionalBreadcrumb, OperacionalTabs } from "../../components/operacional-tabs";

type Props = { params: { id: string } };

export default function EditarLocalTransportePage({ params }: Props) {
  return (
    <div className="space-y-6">
      <OperacionalBreadcrumb current="Editar origem/destino" />
      <OperacionalTabs />
      <LocalTransporteForm localId={params.id} />
    </div>
  );
}
