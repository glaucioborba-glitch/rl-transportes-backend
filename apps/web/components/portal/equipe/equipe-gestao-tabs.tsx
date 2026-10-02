"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OperadoresInternosPanel } from "./operadores-internos-panel";
import { TransportadorasPanel } from "./transportadoras-panel";

type EquipeGestaoTabsProps = {
  clienteId: string;
  podeGerenciar: boolean;
};

/** Gestão de equipe B2B: operadores internos (CPF) + transportadoras autorizadas (CNPJ). */
export function EquipeGestaoTabs({ clienteId, podeGerenciar }: EquipeGestaoTabsProps) {
  return (
    <Tabs defaultValue="operadores" className="w-full">
      <TabsList className="w-full justify-start">
        <TabsTrigger value="operadores">Operadores internos</TabsTrigger>
        <TabsTrigger value="transportadoras">Transportadoras autorizadas</TabsTrigger>
      </TabsList>
      <TabsContent value="operadores">
        <OperadoresInternosPanel clienteId={clienteId} podeGerenciar={podeGerenciar} />
      </TabsContent>
      <TabsContent value="transportadoras">
        <TransportadorasPanel clienteId={clienteId} podeGerenciar={podeGerenciar} />
      </TabsContent>
    </Tabs>
  );
}
