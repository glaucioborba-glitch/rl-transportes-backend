"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { RlLogo } from "@/components/portal/rl-logo";
import { Button } from "@/components/ui/button";
import { clearStaffSessionCookie } from "@/lib/auth-staff-cookie";
import { useRouter } from "next/navigation";

const LINKS: { href: string; label: string; roles?: string[] }[] = [
  { href: "/operador/portaria", label: "Portaria", roles: ["ADMIN", "GERENTE", "OPERADOR_PORTARIA"] },
  { href: "/operador/gate", label: "Gate", roles: ["ADMIN", "GERENTE", "OPERADOR_GATE"] },
  { href: "/operador/patio", label: "Pátio", roles: ["ADMIN", "GERENTE", "OPERADOR_PATIO"] },
  {
    href: "/cockpit",
    label: "Cockpit TOC",
    roles: ["ADMIN", "GERENTE", "OPERADOR_PORTARIA", "OPERADOR_GATE", "OPERADOR_PATIO"],
  },
  { href: "/cockpit/heatmap", label: "Heatmap", roles: ["ADMIN", "GERENTE"] },
  { href: "/cockpit/executivo", label: "Executivo", roles: ["ADMIN", "GERENTE"] },
  { href: "/financeiro/apagar", label: "Financeiro", roles: ["ADMIN", "GERENTE"] },
];

export function OperadorHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useStaffAuthStore((s) => s.user);
  const clear = useStaffAuthStore((s) => s.clear);
  const role = user?.role ?? "";

  const visible = LINKS.filter((l) => !l.roles || l.roles.includes(role));

  function logout() {
    clear();
    clearStaffSessionCookie();
    router.replace("/operador/login");
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#080a0d]/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/operador/portaria" className="flex items-center gap-3">
          <RlLogo />
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">RL Terminal</p>
            <p className="text-sm font-semibold text-white">{user?.email ?? "Operador"}</p>
          </div>
        </Link>
        <nav className="flex flex-wrap items-center gap-1">
          {visible.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium transition-colors min-h-11 flex items-center",
                pathname === href || pathname.startsWith(href + "/")
                  ? "bg-white/15 text-white"
                  : "text-slate-400 hover:bg-white/5 hover:text-white",
              )}
            >
              {label}
            </Link>
          ))}
          <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => logout()}>
            Sair
          </Button>
        </nav>
      </div>
    </header>
  );
}
