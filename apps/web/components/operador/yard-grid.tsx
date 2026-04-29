"use client";

import { QuadraCard } from "@/components/operador/quadra-card";

export type YardBucket = { codigo: string; items: { solicitacaoId: string; protocolo: string; n: number }[] };

export function YardGrid({
  buckets,
  capPerQuad,
  onSelectQuadra,
}: {
  buckets: YardBucket[];
  capPerQuad: number;
  onSelectQuadra: (codigo: string) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {buckets.map((b) => (
        <QuadraCard
          key={b.codigo}
          codigo={b.codigo}
          ocupacao={b.items.length}
          cap={capPerQuad}
          onOpen={() => onSelectQuadra(b.codigo)}
        />
      ))}
    </div>
  );
}
