"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { RlLogo } from "@/components/portal/rl-logo";
import { Button } from "@/components/ui/button";
import { clearStaffSessionCookie } from "@/lib/auth-staff-cookie";

const NAV = [
  { href: "/financeiro/apagar", label: "Contas a pagar" },
  { href: "/financeiro/areceber", label: "A receber" },
  { href: "/financeiro/tesouraria", label: "Tesouraria" },
  { href: "/financeiro/bancos", label: "Bancos" },
];

export function FinanceiroHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useStaffAuthStore((s) => s.user);
  const clear = useStaffAuthStore((s) => s.clear);
  const role = user?.role ?? "";
  const allowed = role === "ADMIN" || role === "GERENTE";

  if (!allowed) {
    return (
      <header className="border-b border-white/10 bg-zinc-950/95 px-4 py-3">
        <p className="text-center text-sm text-amber-400">Área restrita a gestão (ADMIN / GERENTE).</p>
      </header>
    );
  }

  function logout() {
    clear();
    clearStaffSessionCookie();
    router.replace("/operador/login");
  }

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/financeiro/apagar" className="flex items-center gap-3">
          <RlLogo />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Financeiro</p>
            <p className="text-sm font-semibold text-white">Tesouraria corporativa</p>
          </div>
        </Link>
        <nav className="flex flex-wrap items-center gap-1">
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium transition-colors min-h-11 flex items-center",
                pathname === href || pathname.startsWith(href + "/")
                  ? "bg-amber-500/20 text-amber-100"
                  : "text-zinc-400 hover:bg-white/5 hover:text-white",
              )}
            >
              {label}
            </Link>
          ))}
          <Link
            href="/cockpit/executivo"
            className="rounded-lg px-3 py-2 text-sm text-zinc-500 hover:text-zinc-300 min-h-11 flex items-center"
          >
            Cockpit exec.
          </Link>
          <Button type="button" variant="outline" size="sm" className="min-h-11 border-zinc-700" onClick={() => logout()}>
            Sair
          </Button>
        </nav>
      </div>
    </header>
  );
}
