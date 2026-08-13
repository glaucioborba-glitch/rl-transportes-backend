"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { CircleHelp, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { resolvePortalClienteDisplayName } from "@/lib/portal-cliente-display";
import { usePortalAuthStore } from "@/stores/portal-store";
import { usePessoaPermissoesStore, DEFAULT_PERMISSOES } from "@/stores/pessoaPermissoesStore";
import { RlLogo } from "./rl-logo";

const NAV_ALL = [
  { href: "/portal/dashboard", label: "Dashboard" },
  { href: "/portal/solicitacoes", label: "Solicitações", perm: "podeVerOS" as const },
  { href: "/cliente/portal/patiamento", label: "Meu Patiamento", perm: "podeVerOS" as const },
  { href: "/portal/financeiro", label: "Financeiro", perm: "podeVisualizarFinanceiro" as const },
  { href: "/portal/documentos", label: "Documentos" },
  { href: "/portal/perfil/seguranca", label: "Segurança" },
  { href: "/portal/perfil", label: "Perfil" },
] as const;

export function PortalHeader() {
  const pathname = usePathname();
  const cliente = usePortalAuthStore((s) => s.cliente);
  const clienteNome = usePortalAuthStore((s) => s.clienteNome);
  const permissoes = usePessoaPermissoesStore((s) => s.permissoes);
  const [mobileOpen, setMobileOpen] = useState(false);

  const NAV = useMemo(
    () =>
      NAV_ALL.filter((item) => {
        if (!("perm" in item) || !item.perm) return true;
        const p = permissoes ?? DEFAULT_PERMISSOES;
        return !!p[item.perm];
      }),
    [permissoes],
  );

  const empresaNome = resolvePortalClienteDisplayName(cliente, clienteNome) ?? "Portal";

  const linkCls = (href: string) =>
    cn(
      "whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors",
      pathname === href || (href !== "/portal/dashboard" && pathname.startsWith(href))
        ? "bg-white/10 text-white"
        : "text-slate-400 hover:bg-white/5 hover:text-white",
    );

  const identityBlock = (
    <p className="truncate text-sm font-semibold text-white">{empresaNome}</p>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#080a0d]/80 backdrop-blur-xl">
      <div className="mx-auto grid max-w-7xl grid-cols-12 items-center gap-4 px-4 py-3">
        <div className="col-span-12 flex items-center justify-between gap-4 md:col-span-4">
          <Link href="/portal/solicitacoes" className="flex min-w-0 items-center gap-3">
            <RlLogo />
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-xs font-medium uppercase tracking-widest text-slate-500">
                RL Transportes
              </p>
              {identityBlock}
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
            <Link
              key={href}
              href={href}
              className={linkCls(href)}
              {...(href === "/portal/financeiro" ? { "data-tour": "nav-financeiro" } : {})}
            >
              {label}
            </Link>
          ))}
          <Link
            href="/portal/perfil"
            data-tour="ajuda-perfil"
            className={cn(
              "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white",
              pathname.startsWith("/portal/perfil") && "bg-white/10 text-white",
            )}
            aria-label="Ajuda e perfil"
          >
            <CircleHelp className="h-4 w-4 shrink-0" aria-hidden />
            <span className="hidden lg:inline">Ajuda</span>
          </Link>
        </nav>
      </div>
      {mobileOpen && (
        <nav className="flex flex-col gap-1 border-t border-white/10 px-4 pb-4 md:hidden">
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={linkCls(href)}
              onClick={() => setMobileOpen(false)}
              {...(href === "/portal/financeiro" ? { "data-tour": "nav-financeiro" } : {})}
            >
              {label}
            </Link>
          ))}
          <Link
            href="/portal/perfil"
            data-tour="ajuda-perfil"
            className={linkCls("/portal/perfil")}
            onClick={() => setMobileOpen(false)}
          >
            Ajuda / Perfil
          </Link>
        </nav>
      )}
      <div className="px-4 pb-3 text-center sm:hidden">{identityBlock}</div>
    </header>
  );
}
