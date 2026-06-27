"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { RlLogo } from "@/components/portal/rl-logo";
import { Button } from "@/components/ui/button";
import { clearStaffSessionCookie } from "@/lib/auth-staff-cookie";

const NAV_BASE: {
  href: string;
  label: string;
  accent: string;
  roles: readonly string[];
}[] = [
  { href: "/bi/visao-operacional", label: "Visão Operacional", accent: "text-cyan-400", roles: ["ADMIN", "GERENTE"] },
  { href: "/bi/torre-de-controle", label: "Torre de Controle", accent: "text-violet-400", roles: ["ADMIN"] },
  { href: "/bi/operacional", label: "Legado · Ops", accent: "text-zinc-400", roles: ["ADMIN", "GERENTE"] },
  { href: "/bi/financeiro", label: "Legado · Fin", accent: "text-emerald-400", roles: ["ADMIN"] },
  { href: "/bi/corporativo", label: "Corporativo", accent: "text-blue-400", roles: ["ADMIN", "GERENTE"] },
];

export function BiHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useStaffAuthStore((s) => s.user);
  const clear = useStaffAuthStore((s) => s.clear);
  const role = user?.role;
  const allowed = role === "ADMIN" || role === "GERENTE";

  const nav = NAV_BASE.filter((item) => role && item.roles.includes(role));

  function logout() {
    clear();
    clearStaffSessionCookie();
    router.replace("/login/staff");
  }

  if (!allowed) {
    return (
      <header className="border-b border-white/10 bg-[#050a0e] px-4 py-3">
        <p className="text-center text-sm text-amber-400">BI restrito a ADMIN / GERENTE.</p>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 border-b border-cyan-500/20 bg-[#04080c]/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1680px] flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href={role === "ADMIN" ? "/bi/torre-de-controle" : "/bi/visao-operacional"} className="flex items-center gap-3">
          <RlLogo />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-cyan-500/80">Business Intelligence</p>
            <p className="text-sm font-semibold text-white">Centro de decisão</p>
          </div>
        </Link>
        <Button type="button" variant="outline" size="sm" className="border-zinc-600" onClick={() => logout()}>
          Sair
        </Button>
      </div>
      <nav className="border-t border-white/5 bg-[#030608]/95">
        <div className="mx-auto flex max-w-[1680px] gap-1 overflow-x-auto px-2 py-2">
          {nav.map(({ href, label, accent }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "whitespace-nowrap rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wide",
                  active ? cn("bg-white/10 ring-1 ring-white/20", accent) : "text-zinc-500 hover:bg-white/5 hover:text-white",
                )}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
