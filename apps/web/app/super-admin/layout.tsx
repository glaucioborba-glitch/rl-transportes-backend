"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SuperAdminShell } from "@/components/super-admin/super-admin-shell";

export default function SuperAdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/super-admin/login")) {
    return children;
  }
  return <SuperAdminShell>{children}</SuperAdminShell>;
}
