"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const PARAMETROS_TABS = [
  { label: "Operacional", href: "/cadastros/parametros/operacional" },
  { label: "Financeiro", href: "/cadastros/parametros/financeiro" },
  { label: "Fiscal", href: "/cadastros/parametros/fiscal" },
  { label: "Segurança", href: "/cadastros/parametros/seguranca" },
  { label: "Integrações", href: "/cadastros/parametros/integracoes" },
  { label: "Notificações", href: "/cadastros/parametros/notificacoes" },
  { label: "Feature Flags", href: "/cadastros/parametros/feature-flags" },
] as const;

export function ParametrosTabs() {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap gap-2 border-b border-border pb-2">
      {PARAMETROS_TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "text-sm",
              active && "bg-[var(--accent)]/10 text-[var(--accent)]",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

export function ParametrosBreadcrumb({ current }: { current: string }) {
  return (
    <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
      <Link href="/cadastros/parametros" className="hover:text-foreground">
        Parâmetros
      </Link>
      <span>/</span>
      <span>{current}</span>
    </div>
  );
}
