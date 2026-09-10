"use client";

import Link from "next/link";
import { Boxes } from "lucide-react";
import { OperacionalTabs } from "./components/operacional-tabs";

export default function OperacionalPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Operacional</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tipos de contêiner, equipamentos, posições, operações, turnos, motivos de rejeição, origens/destinos e unidades de aluguel
        </p>
      </div>

      <OperacionalTabs />

      <div className="flex h-[40vh] flex-col items-center justify-center gap-3">
        <Boxes className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-lg text-muted-foreground">Selecione uma sub-entidade acima.</p>
        <p className="text-sm text-muted-foreground/70">
          Comece por{" "}
          <Link href="/cadastros/operacional/posicoes-patio" className="text-[var(--accent)] hover:underline">
            Posições de Pátio
          </Link>{" "}
          ou{" "}
          <Link href="/cadastros/operacional/tipos-operacao" className="text-[var(--accent)] hover:underline">
            Tipos de Operação
          </Link>{" "}
          ou{" "}
          <Link href="/cadastros/operacional/origens-destinos" className="text-[var(--accent)] hover:underline">
            Origens e destinos
          </Link>{" "}
          ou{" "}
          <Link href="/cadastros/operacional/unidades-aluguel" className="text-[var(--accent)] hover:underline">
            Unidades de aluguel
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
