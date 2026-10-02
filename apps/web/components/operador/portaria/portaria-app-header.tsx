"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SuperAdminActingBanner } from "@/components/intranet/super-admin-acting-banner";
import { sairIntranetTenant } from "@/lib/api/super-admin-client";
import { clearStaffSessionCookie } from "@/lib/auth-staff-cookie";
import { defaultStaffHome } from "@/lib/staff-redirect";
import { useStaffAuthStore } from "@/stores/staff-auth-store";

export function PortariaAppHeader() {
  const router = useRouter();
  const user = useStaffAuthStore((s) => s.user);
  const clear = useStaffAuthStore((s) => s.clear);
  const intranetHref = defaultStaffHome(user?.role);
  const showIntranet = intranetHref !== "/operador/portaria";

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

  return (
    <>
      <SuperAdminActingBanner compact />
    <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-sky-400/80">
          App da portaria
        </p>
        <p className="text-sm font-semibold text-white">Check-in no tablet</p>
      </div>
      <div className="flex items-center gap-2">
        {showIntranet ? (
          <Button variant="outline" size="sm" className="border-zinc-600" asChild>
            <Link href={intranetHref}>Intranet</Link>
          </Button>
        ) : null}
        <Button type="button" variant="outline" size="sm" className="border-zinc-600" onClick={() => void logout()}>
          Sair
        </Button>
      </div>
    </header>
    </>
  );
}
