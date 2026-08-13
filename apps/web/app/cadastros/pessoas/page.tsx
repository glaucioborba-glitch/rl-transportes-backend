"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Clientes", href: "/cadastros/pessoas/clientes", implemented: true },
  { label: "Colaboradores", href: "/cadastros/pessoas/colaboradores", implemented: true },
  { label: "Transportadoras", href: "/cadastros/pessoas/transportadoras", implemented: true },
  { label: "Motoristas", href: "/cadastros/pessoas/motoristas", implemented: true },
  { label: "Fornecedores", href: null, implemented: false },
  { label: "Visitantes", href: null, implemented: false },
] as const;

export default function PessoasPage() {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pessoas & Entidades</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Clientes, Colaboradores, Motoristas, Transportadoras, Fornecedores, Visitantes
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
        <Database className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-lg text-muted-foreground">
          Selecione uma sub-entidade acima ou acesse{" "}
          <Link href="/cadastros/pessoas/clientes" className="text-[var(--accent)] hover:underline">
            Clientes
          </Link>{" "}
          /{" "}
          <Link
            href="/cadastros/pessoas/colaboradores"
            className="text-[var(--accent)] hover:underline"
          >
            Colaboradores
          </Link>
          ,{" "}
          <Link
            href="/cadastros/pessoas/transportadoras"
            className="text-[var(--accent)] hover:underline"
          >
            Transportadoras
          </Link>{" "}
          ou{" "}
          <Link
            href="/cadastros/pessoas/motoristas"
            className="text-[var(--accent)] hover:underline"
          >
            Motoristas
          </Link>
          .
        </p>
        <p className="text-sm text-muted-foreground/70">
          Fornecedores e Visitantes serão implementados nos próximos PRs.
        </p>
      </div>
    </div>
  );
}
