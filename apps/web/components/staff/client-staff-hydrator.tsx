"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { staffJson } from "@/lib/api/staff-client";
import type { AuthMeResponse } from "@/lib/api/types";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { useStaffSession } from "@/hooks/useStaffSession";

const STAFF_PATH_PREFIXES = [
  "/operador",
  "/cockpit",
  "/financeiro",
  "/rh",
  "/admin",
  "/bi",
  "/ssma",
  "/grc",
  "/digital-twin",
  "/ai-console",
  "/sdt",
  "/aog",
  "/agi",
  "/staff",
];

function isStaffArea(path: string | null): boolean {
  if (!path) return false;
  if (
    path.startsWith("/login/staff") ||
    path.startsWith("/auth/login") ||
    path.startsWith("/operador/login")
  ) {
    return false;
  }
  return STAFF_PATH_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

/** Carrega o usuário a partir de cookies HttpOnly (`GET /auth/me`) quando a store ainda está vazia. */
export function ClientStaffHydrator() {
  const pathname = usePathname();
  const user = useStaffAuthStore((s) => s.user);
  const setUser = useStaffAuthStore((s) => s.setUser);

  useStaffSession();

  useEffect(() => {
    if (!isStaffArea(pathname) || user) return;
    void (async () => {
      try {
        const me = await staffJson<AuthMeResponse>("/auth/me");
        setUser({
          id: me.id,
          cpfCnpj: me.cpfCnpj,
          email: me.email,
          role: me.role,
          permissions: me.permissions,
          clienteId: me.clienteId ?? null,
        });
      } catch {
        /* middleware já bloqueou rota sem sessão; ignore */
      }
    })();
  }, [pathname, user, setUser]);

  return null;
}
