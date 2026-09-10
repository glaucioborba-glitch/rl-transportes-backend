"use client";

import { OperacionalBreadcrumb, OperacionalTabs } from "../../components/operacional-tabs";
import { UnidadeAluguelForm } from "../components/unidade-aluguel-form";

export default function NovaUnidadeAluguelPage() {
  return (
    <div className="space-y-6">
      <OperacionalBreadcrumb current="Nova unidade de aluguel" />
      <OperacionalTabs />
      <UnidadeAluguelForm />
    </div>
  );
}
