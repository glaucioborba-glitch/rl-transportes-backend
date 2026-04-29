"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { RlLogo } from "@/components/portal/rl-logo";
import { Button } from "@/components/ui/button";
import { clearStaffSessionCookie } from "@/lib/auth-staff-cookie";

const LINKS: { href: string; label: string }[] = [
  { href: "/rh", label: "Painel" },
  { href: "/rh/colaboradores", label: "Colaboradores" },
  { href: "/rh/estrutura", label: "Estrutura" },
  { href: "/rh/jornada", label: "Jornada" },
  { href: "/rh/jornada/escala", label: "Escala" },
  { href: "/rh/jornada/ponto", label: "Ponto" },
  { href: "/rh/jornada/turnos", label: "Turnos 24h" },
  { href: "/rh/competencias", label: "Competências" },
];

export function RhHeader() {
  const router = useRouter();
  const user = useStaffAuthStore((s) => s.user);
  const clear = useStaffAuthStore((s) => s.clear);
  const role = user?.role ?? "";
  const allowed = role === "ADMIN" || role === "GERENTE";

  function logout() {
    clear();
    clearStaffSessionCookie();
    router.replace("/operador/login");
  }

  if (!allowed) {
    return (
      <header className="border-b border-white/10 bg-zinc-950/95 px-4 py-3">
        <p className="text-center text-sm text-amber-400">Módulo RH visível apenas para ADMIN / GERENTE.</p>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 border-b border-cyan-500/15 bg-zinc-950/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/rh" className="flex items-center gap-3">
          <RlLogo />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-cyan-500/80">RH / DP</p>
            <p className="text-sm font-semibold text-white">Governança operacional</p>
          </div>
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/cockpit/executivo"
            className="rounded-lg px-3 py-2 text-xs text-zinc-500 hover:text-zinc-300 min-h-11 flex items-center"
          >
            Cockpit
          </Link>
          <Button type="button" variant="outline" size="sm" className="min-h-11 border-zinc-700" onClick={() => logout()}>
            Sair
          </Button>
        </div>
      </div>
    </header>
  );
}

export function RhSideNav() {
  const pathname = usePathname();
  const user = useStaffAuthStore((s) => s.user);
  const allowed = user?.role === "ADMIN" || user?.role === "GERENTE";
  if (!allowed) return null;

  return (
    <nav
      aria-label="RH"
      className="flex w-full shrink-0 flex-col gap-1 border-b border-white/10 bg-zinc-950/90 p-3 sm:w-52 sm:border-b-0 sm:border-r sm:min-h-[calc(100vh-57px)]"
    >
      <p className="mb-2 hidden text-[10px] font-bold uppercase tracking-widest text-zinc-500 sm:block">
        Navegação
      </p>
      <div className="flex max-h-[42vh] flex-row gap-1 overflow-x-auto pb-1 sm:max-h-none sm:flex-col sm:overflow-visible sm:pb-0">
        {LINKS.map(({ href, label }) => {
          const active = pathname === href || (href !== "/rh" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition-colors min-h-11 flex items-center",
                active ? "bg-cyan-500/15 text-cyan-100 ring-1 ring-cyan-500/30" : "text-zinc-400 hover:bg-white/5 hover:text-white",
              )}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
