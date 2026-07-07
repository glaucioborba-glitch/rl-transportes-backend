"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SolicitacoesEscopo } from "@/lib/api/portal-client";

export function SolicitacoesEscopoTabs({
  value,
  onChange,
}: {
  value: SolicitacoesEscopo;
  onChange: (escopo: SolicitacoesEscopo) => void;
}) {
  return (
    <Tabs
      value={value}
      onValueChange={(v) => onChange(v as SolicitacoesEscopo)}
      className="w-full"
    >
      <TabsList className="h-auto w-full justify-start gap-1 rounded-none border-b border-white/10 bg-transparent p-0">
        <TabsTrigger
          value="todas"
          className="rounded-none border-b-2 border-transparent bg-transparent px-4 py-2.5 text-slate-400 shadow-none data-[state=active]:border-[var(--accent)] data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none"
        >
          Todas da Empresa
        </TabsTrigger>
        <TabsTrigger
          value="minhas"
          className="rounded-none border-b-2 border-transparent bg-transparent px-4 py-2.5 text-slate-400 shadow-none data-[state=active]:border-[var(--accent)] data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none"
        >
          Minhas Solicitações
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
