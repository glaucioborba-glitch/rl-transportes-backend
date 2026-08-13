"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { RlLogo } from "@/components/portal/rl-logo";
import { clearStaffSessionCookie } from "@/lib/auth-staff-cookie";
import { resolveIntranetModule } from "@/lib/intranet/resolve-intranet-module";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { IntranetMasterNav } from "./intranet-master-nav";
import { IntranetSidebar } from "./intranet-sidebar";
import { ApiStatusBanner } from "@/components/ui/api-status-banner";

type Props = {
  children: ReactNode;
  /** Conteúdo full-width sem padding padrão (ex.: dashboard gate) */
  flush?: boolean;
};

export function IntranetShell({ children, flush = false }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useStaffAuthStore((s) => s.user);
  const clear = useStaffAuthStore((s) => s.clear);
  const moduleId = resolveIntranetModule(pathname);

  function logout() {
    clear();
    clearStaffSessionCookie();
    router.replace("/login/staff");
  }

  return (
    <div className="flex h-screen flex-col bg-[#080a0d] text-slate-100">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-white/10 px-4">
        <Link href="/operador/dashboard" className="flex shrink-0 items-center gap-2">
          <RlLogo />
        </Link>
        <IntranetMasterNav activeModule={moduleId} />
        <div className="ml-auto flex shrink-0 items-center gap-3">
          <span className="hidden max-w-[180px] truncate text-xs text-slate-400 sm:inline">
            {user?.email ?? "Operador"}
          </span>
          <Button type="button" variant="outline" size="sm" onClick={() => logout()}>
            Sair
          </Button>
        </div>
      </header>

      <ApiStatusBanner />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <IntranetSidebar moduleId={moduleId} />
        <main
          className={
            flush
              ? "min-w-0 flex-1 overflow-y-auto"
              : "min-w-0 flex-1 overflow-y-auto px-4 py-6 lg:px-6"
          }
        >
          {children}
        </main>
      </div>
    </div>
  );
}
