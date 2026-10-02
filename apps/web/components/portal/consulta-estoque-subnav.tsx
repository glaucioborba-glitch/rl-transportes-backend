"use client";

import { usePathname, useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CONSULTA_ESTOQUE_HREF, ORGANIZADOR_EMBARQUE_HREF } from "@/lib/portal-patio-display";

const TAB_CLASS =
  "rounded-none border-b-2 border-transparent bg-transparent px-4 py-2.5 text-slate-400 shadow-none data-[state=active]:border-[var(--accent)] data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none";

export function ConsultaEstoqueSubnav() {
  const pathname = usePathname();
  const router = useRouter();
  const value = pathname.startsWith(ORGANIZADOR_EMBARQUE_HREF) ? "organizador" : "saldo";

  return (
    <Tabs
      value={value}
      onValueChange={(next) => {
        router.push(next === "organizador" ? ORGANIZADOR_EMBARQUE_HREF : CONSULTA_ESTOQUE_HREF);
      }}
      className="w-full"
    >
      <TabsList className="h-auto w-full justify-start gap-1 rounded-none border-b border-white/10 bg-transparent p-0">
        <TabsTrigger value="saldo" className={TAB_CLASS}>
          Saldo de pátio
        </TabsTrigger>
        <TabsTrigger value="organizador" className={TAB_CLASS}>
          Organizador de embarque
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
