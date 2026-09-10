"use client";

import { LocalTransporteForm } from "../components/local-transporte-form";
import { OperacionalBreadcrumb, OperacionalTabs } from "../../components/operacional-tabs";

export default function NovoLocalTransportePage() {
  return (
    <div className="space-y-6">
      <OperacionalBreadcrumb current="Nova origem/destino" />
      <OperacionalTabs />
      <LocalTransporteForm />
    </div>
  );
}
