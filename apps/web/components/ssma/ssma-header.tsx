"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { Button } from "@/components/ui/button";
import { clearStaffSessionCookie } from "@/lib/auth-staff-cookie";
import { RlLogo } from "@/components/portal/rl-logo";

const NAV = [
  { href: "/ssma/incidentes", label: "Incidentes" },
  { href: "/ssma/compliance", label: "Compliance NR" },
  { href: "/ssma/ptw", label: "PTW & Cultura" },
];

export function SsmaHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useStaffAuthStore((s) => s.user);
  const clear = useStaffAuthStore((s) => s.clear);
  const allowed = user?.role === "ADMIN" || user?.role === "GERENTE";

  function logout() {
    clear();
    clearStaffSessionCookie();
    router.replace("/operador/login");
  }

  if (!allowed) {
    return (
      <header className="border-b border-amber-500/20 bg-[#0a0806] px-4 py-3">
        <p className="text-center text-sm text-amber-400">SSMA — acesso restrito a ADMIN / GERENTE.</p>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 border-b border-amber-500/25 bg-[#080604]/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1680px] flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/ssma/incidentes" className="flex items-center gap-3">
          <RlLogo />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-500/90">SSMA</p>
            <p className="text-sm font-semibold text-white">Segurança, saúde e meio ambiente</p>
          </div>
        </Link>
        <Button type="button" variant="outline" size="sm" className="border-zinc-600" onClick={() => logout()}>
          Sair
        </Button>
      </div>
      <nav className="border-t border-white/5 bg-[#060504]/95">
        <div className="mx-auto flex max-w-[1680px] gap-1 overflow-x-auto px-2 py-2">
          {NAV.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "whitespace-nowrap rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wide",
                  active ? "bg-amber-600/25 text-amber-200 ring-1 ring-amber-500/30" : "text-zinc-500 hover:bg-white/5 hover:text-white",
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
