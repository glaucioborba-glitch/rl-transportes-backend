"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { RlLogo } from "@/components/portal/rl-logo";
import { clearStaffSessionCookie } from "@/lib/auth-staff-cookie";
import { isFretesFocusPath, resolveIntranetModule } from "@/lib/intranet/resolve-intranet-module";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { IntranetMasterNav } from "./intranet-master-nav";
import { IntranetSidebar } from "./intranet-sidebar";
import { ApiStatusBanner } from "@/components/ui/api-status-banner";
import { PageBackButton } from "@/components/ui/page-back-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { resolvePageBackHref } from "@/lib/intranet/page-back-href";
import { SuperAdminActingBanner } from "@/components/intranet/super-admin-acting-banner";
import { sairIntranetTenant } from "@/lib/api/super-admin-client";

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

  async function logout() {
    if (user?.role === "SUPER_ADMIN") {
      try {
        await sairIntranetTenant();
      } catch {
        /* segue o logout */
      }
      clear();
      clearStaffSessionCookie();
      router.replace("/super-admin/login");
      return;
    }
    clear();
    clearStaffSessionCookie();
    router.replace("/login/staff");
  }

  const fillLocalizacao = pathname.startsWith("/operador/localizacao-motoristas");

  if (isFretesFocusPath(pathname)) {
    return (
      <div className="flex h-screen flex-col bg-[#080a0d] text-slate-100">
        <SuperAdminActingBanner />
        <ApiStatusBanner />
        <main className="min-h-0 min-w-0 flex-1 overflow-hidden">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-[#080a0d] text-slate-100">
      <SuperAdminActingBanner />
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-white/10 px-4">
        <Link href="/operador/dashboard" className="flex shrink-0 items-center gap-2">
          <RlLogo />
        </Link>
        <IntranetMasterNav activeModule={moduleId} />
        <div className="ml-auto flex shrink-0 items-center gap-3">
          <span className="hidden max-w-[180px] truncate text-xs text-slate-400 sm:inline">
            {user?.email ?? "Operador"}
          </span>
          <ThemeToggle />
          <Button type="button" variant="outline" size="sm" onClick={() => void logout()}>
            Sair
          </Button>
        </div>
      </header>

      <ApiStatusBanner />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Suspense fallback={<aside className="h-full w-60 shrink-0 border-r border-white/10 bg-[#06080c]" />}>
          <IntranetSidebar moduleId={moduleId} />
        </Suspense>
        <main
          className={
            fillLocalizacao
              ? "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
              : flush
                ? "min-w-0 flex-1 overflow-y-auto"
                : "min-w-0 flex-1 overflow-y-auto px-4 py-6 lg:px-6"
          }
        >
          <div
            className={
              fillLocalizacao
                ? "flex h-full min-h-0 flex-col"
                : flush
                  ? undefined
                  : "mx-auto w-[90%]"
            }
          >
            {!flush && resolvePageBackHref(pathname) ? (
              <div className="mb-2">
                <PageBackButton />
              </div>
            ) : null}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
