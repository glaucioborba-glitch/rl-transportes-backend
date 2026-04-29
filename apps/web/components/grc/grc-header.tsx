"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { Button } from "@/components/ui/button";
import { clearStaffSessionCookie } from "@/lib/auth-staff-cookie";
import { RlLogo } from "@/components/portal/rl-logo";

const NAV = [
  { href: "/grc/executivo", label: "Executivo" },
  { href: "/grc/governanca", label: "Governança COSO" },
  { href: "/grc/riscos", label: "Riscos ISO 31000" },
];

export function GrcHeader() {
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
      <header className="border-b border-slate-600/30 bg-[#07080c] px-4 py-3">
        <p className="text-center text-sm text-amber-400">GRC — acesso restrito a ADMIN / GERENTE.</p>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 border-b border-indigo-500/25 bg-[#05060a]/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1680px] flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/grc/executivo" className="flex items-center gap-3">
          <RlLogo />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-400/90">GRC</p>
            <p className="text-sm font-semibold text-white">Governança · Risco · Compliance</p>
          </div>
        </Link>
        <Button type="button" variant="outline" size="sm" className="border-zinc-600" onClick={() => logout()}>
          Sair
        </Button>
      </div>
      <nav className="border-t border-white/5 bg-[#04050a]/95">
        <div className="mx-auto flex max-w-[1680px] gap-1 overflow-x-auto px-2 py-2">
          {NAV.map(({ href, label }) => {
            const active =
              href === "/grc/executivo"
                ? pathname === "/grc/executivo"
                : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "whitespace-nowrap rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wide",
                  active ? "bg-indigo-600/30 text-indigo-200 ring-1 ring-indigo-500/35" : "text-zinc-500 hover:bg-white/5 hover:text-white",
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
