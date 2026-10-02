"use client";

import { Suspense } from "react";
import { ControleEntradaSaidaFicha } from "@/components/gate/controle-entrada-saida-ficha";

export default function ControleEntradaSaidaFichaPage({
  params,
}: {
  params: { protocolo: string };
}) {
  const protocolo = decodeURIComponent(params.protocolo);
  return (
    <div className="p-4">
      <Suspense
        fallback={<p className="text-sm text-muted-foreground">Carregando ficha...</p>}
      >
        <ControleEntradaSaidaFicha protocolo={protocolo} />
      </Suspense>
    </div>
  );
}
