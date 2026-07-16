"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Tipos de Contêiner", href: "/cadastros/operacional/tipos-container", implemented: true },
  { label: "Equipamentos", href: "/cadastros/operacional/equipamentos", implemented: true },
  { label: "Posições de Pátio", href: null, implemented: false },
  { label: "Tipos de Operação", href: null, implemented: false },
  { label: "Turnos", href: null, implemented: false },
] as const;

export default function OperacionalPage() {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Operacional</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tipos de Contêiner, Equipamentos, Posições, Tipos de Operação, Turnos
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {TABS.map((tab) => {
          const active = tab.href ? pathname.startsWith(tab.href) : false;
          if (tab.implemented && tab.href) {
            return (
              <Button
                key={tab.label}
                variant="ghost"
                size="sm"
                className={cn("text-sm", active && "bg-[var(--accent)]/10 text-[var(--accent)]")}
                asChild
              >
                <Link href={tab.href}>{tab.label}</Link>
              </Button>
            );
          }
          return (
            <Button key={tab.label} variant="ghost" size="sm" className="text-sm" disabled>
              {tab.label}
            </Button>
          );
        })}
      </div>

      <div className="flex h-[50vh] flex-col items-center justify-center gap-3">
        <Boxes className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-lg text-muted-foreground">
          Selecione uma sub-entidade acima ou acesse{" "}
          <Link
            href="/cadastros/operacional/tipos-container"
            className="text-[var(--accent)] hover:underline"
          >
            Tipos de Contêiner
          </Link>{" "}
          ou{" "}
          <Link
            href="/cadastros/operacional/equipamentos"
            className="text-[var(--accent)] hover:underline"
          >
            Equipamentos
          </Link>
          .
        </p>
        <p className="text-sm text-muted-foreground/70">
          Posições, Tipos de Operação e Turnos serão implementados nos próximos PRs.
        </p>
      </div>
    </div>
  );
}
