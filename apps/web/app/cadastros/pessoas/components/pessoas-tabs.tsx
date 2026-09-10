"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const PESSOAS_TABS = [
  { label: "Clientes", href: "/cadastros/pessoas/clientes" },
  { label: "Colaboradores", href: "/cadastros/pessoas/colaboradores" },
  { label: "Transportadoras", href: "/cadastros/pessoas/transportadoras" },
  { label: "Motoristas", href: "/cadastros/pessoas/motoristas" },
  { label: "Terceiros", href: "/cadastros/pessoas/terceiros" },
] as const;

export function PessoasTabs() {
  const pathname = usePathname();
  return (
    <div className="flex flex-wrap gap-2 border-b border-border pb-2">
      {PESSOAS_TABS.map((tab) => {
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
      <Button variant="ghost" size="sm" className="text-sm" disabled>
        Fornecedores
      </Button>
      <Button variant="ghost" size="sm" className="text-sm" disabled>
        Visitantes
      </Button>
    </div>
  );
}
