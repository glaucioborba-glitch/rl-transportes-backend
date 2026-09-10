"use client";

import { OperacionalBreadcrumb, OperacionalTabs } from "../../components/operacional-tabs";
import { UnidadeAluguelForm } from "../components/unidade-aluguel-form";

export default function EditarUnidadeAluguelPage({ params }: { params: { id: string } }) {
  return (
    <div className="space-y-6">
      <OperacionalBreadcrumb current="Editar unidade de aluguel" />
      <OperacionalTabs />
      <UnidadeAluguelForm unidadeId={params.id} />
    </div>
  );
}
