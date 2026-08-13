"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const OPERACIONAL_TABS = [
  { label: "Tipos de Contêiner", href: "/cadastros/operacional/tipos-container" },
  { label: "Equipamentos", href: "/cadastros/operacional/equipamentos" },
  { label: "Posições de Pátio", href: "/cadastros/operacional/posicoes-patio" },
  { label: "Tipos de Operação", href: "/cadastros/operacional/tipos-operacao" },
  { label: "Turnos", href: "/cadastros/operacional/turnos" },
  { label: "Motivos de Rejeição", href: "/cadastros/operacional/motivos-rejeicao" },
] as const;

export function OperacionalTabs() {
  const pathname = usePathname();
  return (
    <div className="flex flex-wrap gap-2 border-b border-border pb-2">
      {OPERACIONAL_TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Button
            key={tab.href}
            variant="ghost"
            size="sm"
            className={cn("text-sm", active && "bg-[var(--accent)]/10 text-[var(--accent)]")}
            asChild
          >
            <Link href={tab.href}>{tab.label}</Link>
          </Button>
        );
      })}
    </div>
  );
}

export function OperacionalBreadcrumb({ current }: { current: string }) {
  return (
    <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
      <Link href="/cadastros/operacional" className="hover:text-white">
        Operacional
      </Link>
      <span>/</span>
      <span>{current}</span>
    </div>
  );
}
