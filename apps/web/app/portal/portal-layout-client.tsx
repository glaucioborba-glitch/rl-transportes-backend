"use client";

import { usePathname } from "next/navigation";
import { PortalShell } from "@/components/portal/portal-shell";

export function PortalLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const publicPortal =
    pathname?.startsWith("/portal/login") ||
    pathname?.startsWith("/portal/cadastrar") ||
    pathname?.startsWith("/portal/recuperar") ||
    pathname?.startsWith("/portal/redefinir") ||
    pathname?.startsWith("/portal/auth/select-pessoa") ||
    pathname?.startsWith("/portal/dev/email-preview");
  if (publicPortal) {
    return <>{children}</>;
  }
  return <PortalShell>{children}</PortalShell>;
}
