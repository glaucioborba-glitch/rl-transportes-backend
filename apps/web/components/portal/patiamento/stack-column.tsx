"use client";

import type { Pilha } from "@/lib/patiamento/types";
import { exigeRemocao, isTopoDaPilha, sortContainersByPosicao } from "@/lib/patiamento/utils";
import { ContainerBlock } from "./container-block";

export function StackColumn({
  pilha,
  onAgendar,
}: {
  pilha: Pilha;
  onAgendar: (containerId: string, exigeShifting: boolean) => void;
}) {
  const sorted = sortContainersByPosicao(pilha.containers);

  return (
    <section
      className="flex min-w-[12rem] flex-shrink-0 flex-col items-center"
      aria-label={`Pilha ${pilha.codigo}`}
    >
      <header className="mb-3 text-center">
        <p className="text-xs font-medium uppercase tracking-widest text-slate-500">Baia</p>
        <h3 className="text-lg font-bold text-white">{pilha.codigo}</h3>
        <p className="text-xs text-slate-500">{sorted.length} unidade(s)</p>
      </header>

      <div className="flex w-full flex-col items-center">
        {/* Área de empilhamento — column-reverse: base (pos 1) embaixo */}
        <div className="flex min-h-[12rem] w-full flex-col-reverse items-center gap-2 px-1 py-2">
          {sorted.map((container) => (
            <ContainerBlock
              key={container.id}
              container={container}
              noTopo={isTopoDaPilha(container, pilha)}
              onAgendar={() => onAgendar(container.id, exigeRemocao(container, pilha))}
            />
          ))}
        </div>

        {/* Chão do pátio */}
        <div
          className="mt-1 h-3 w-full max-w-[14rem] rounded-b-md border-b-4 border-slate-600 bg-gradient-to-b from-slate-700 to-slate-800 shadow-inner"
          aria-hidden
        />
        <div
          className="h-1.5 w-[110%] max-w-[15rem] rounded-full bg-slate-900/80"
          aria-hidden
        />
      </div>
    </section>
  );
}
