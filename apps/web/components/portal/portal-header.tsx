"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePortalAuthStore } from "@/stores/portal-store";
import { RlLogo } from "./rl-logo";

const NAV = [
  { href: "/portal/dashboard", label: "Dashboard" },
  { href: "/portal/solicitacoes", label: "Solicitações" },
  { href: "/portal/agendamentos", label: "Agendamentos" },
  { href: "/portal/financeiro", label: "Financeiro" },
  { href: "/portal/documentos", label: "Documentos" },
  { href: "/portal/perfil", label: "Perfil" },
] as const;

export function PortalHeader() {
  const pathname = usePathname();
  const clienteNome = usePortalAuthStore((s) => s.clienteNome);
  const user = usePortalAuthStore((s) => s.user);
  const [mobileOpen, setMobileOpen] = useState(false);

  const display = clienteNome ?? user?.email ?? "Portal";

  const linkCls = (href: string) =>
    cn(
      "whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors",
      pathname === href || (href !== "/portal/dashboard" && pathname.startsWith(href))
        ? "bg-white/10 text-white"
        : "text-slate-400 hover:bg-white/5 hover:text-white",
    );

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#080a0d]/80 backdrop-blur-xl">
      <div className="mx-auto grid max-w-7xl grid-cols-12 items-center gap-4 px-4 py-3">
        <div className="col-span-12 flex items-center justify-between gap-4 md:col-span-4">
          <Link href="/portal/dashboard" className="flex min-w-0 items-center gap-3">
            <RlLogo />
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-xs font-medium uppercase tracking-widest text-slate-500">
                RL Transportes
              </p>
              <p className="truncate text-sm font-semibold text-white">{display}</p>
            </div>
          </Link>
          <div className="md:hidden">
            <Button
              variant="outline"
              size="icon"
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
              onClick={() => setMobileOpen((o) => !o)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
        <nav className="col-span-12 hidden flex-wrap items-center justify-end gap-1 md:col-span-8 md:flex">
          {NAV.map(({ href, label }) => (
            <Link key={href} href={href} className={linkCls(href)}>
              {label}
            </Link>
          ))}
        </nav>
      </div>
      {mobileOpen && (
        <nav className="flex flex-col gap-1 border-t border-white/10 px-4 pb-4 md:hidden">
          {NAV.map(({ href, label }) => (
            <Link key={href} href={href} className={linkCls(href)} onClick={() => setMobileOpen(false)}>
              {label}
            </Link>
          ))}
        </nav>
      )}
      <p className="px-4 pb-3 text-center text-xs text-slate-500 sm:hidden">{display}</p>
    </header>
  );
}
