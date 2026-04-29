"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { RlLogo } from "@/components/portal/rl-logo";
import { Button } from "@/components/ui/button";
import { clearStaffSessionCookie } from "@/lib/auth-staff-cookie";

const NAV = [
  { href: "/admin/executivo", label: "Executivo" },
  { href: "/admin/contratos", label: "Contratos" },
  { href: "/admin/juridico", label: "Jurídico" },
  { href: "/admin/juridico/riscos", label: "Riscos" },
  { href: "/admin/documentos", label: "Documentos" },
  { href: "/admin/penalidades", label: "Penalidades" },
  { href: "/admin/servicos", label: "Serviços" },
  { href: "/admin/slainterno", label: "SLA interno" },
];

export function AdminHeader() {
  const router = useRouter();
  const pathname = usePathname();
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
      <header className="border-b border-white/10 bg-[#070b12] px-4 py-3">
        <p className="text-center text-sm text-amber-400">Área administrativa restrita a ADMIN / GERENTE.</p>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 border-b border-emerald-500/10 bg-[#070b12]/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/admin/executivo" className="flex items-center gap-3">
          <RlLogo />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-500/80">Administração</p>
            <p className="text-sm font-semibold text-white">Governança B2B</p>
          </div>
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" className="border-zinc-700" onClick={() => logout()}>
            Sair
          </Button>
        </div>
      </div>
      <nav className="border-t border-white/5 bg-[#060910]/95">
        <div className="mx-auto flex max-w-[1600px] gap-1 overflow-x-auto px-2 py-2">
          {NAV.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-colors",
                  active ? "bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-500/25" : "text-zinc-400 hover:bg-white/5 hover:text-white",
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
