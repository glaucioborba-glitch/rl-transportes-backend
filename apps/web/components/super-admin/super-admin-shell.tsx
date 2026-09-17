"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { sairIntranetTenant } from "@/lib/api/super-admin-client";
import { clearStaffSessionCookie } from "@/lib/auth-staff-cookie";
import { useStaffAuthStore } from "@/stores/staff-auth-store";

const NAV = [
  { href: "/super-admin", label: "Terminais SaaS" },
  { href: "/super-admin/integracoes", label: "Integrações" },
  { href: "/super-admin/catalogo-containers", label: "Catálogo de caixas" },
  { href: "/super-admin/tipos-container", label: "Tipos de contêiner" },
];

export function SuperAdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const clear = useStaffAuthStore((s) => s.clear);

  async function logout() {
    try {
      await sairIntranetTenant();
    } catch {
      /* segue o logout */
    }
    clear();
    clearStaffSessionCookie();
    router.replace("/super-admin/login");
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-violet-500/20 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-violet-400">RL Transportes SaaS</p>
            <h1 className="text-lg font-semibold text-white">Super Admin</h1>
          </div>
          <div className="flex items-center gap-2">
            <nav className="flex gap-2">
              {NAV.map((item) => {
                const active =
                  item.href === "/super-admin"
                    ? pathname === item.href
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={
                      active
                        ? "rounded-md bg-violet-600 px-3 py-1.5 text-sm text-white"
                        : "rounded-md px-3 py-1.5 text-sm text-zinc-400 hover:bg-white/5 hover:text-white"
                    }
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <Button type="button" variant="outline" size="sm" onClick={() => void logout()}>
              Sair
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
