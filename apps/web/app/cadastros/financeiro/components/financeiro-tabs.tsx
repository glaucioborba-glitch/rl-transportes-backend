"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const FINANCEIRO_TABS = [
  { label: "Bancos", href: "/cadastros/financeiro/bancos" },
  { label: "Centros de Custo", href: "/cadastros/financeiro/centros-custo" },
  { label: "Plano de Contas", href: "/cadastros/financeiro/plano-contas" },
  { label: "Tabelas de Preços", href: "/cadastros/financeiro/tabelas-precos" },
] as const;

export function FinanceiroTabs() {
  const pathname = usePathname();
  return (
    <div className="flex flex-wrap gap-2 border-b border-border pb-2">
      {FINANCEIRO_TABS.map((tab) => {
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

export function FinanceiroBreadcrumb({ current }: { current: string }) {
  return (
    <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
      <Link href="/cadastros/financeiro" className="hover:text-white">
        Financeiro
      </Link>
      <span>/</span>
      <span>{current}</span>
    </div>
  );
}
