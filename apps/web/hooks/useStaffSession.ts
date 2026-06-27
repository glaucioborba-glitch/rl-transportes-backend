"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ApiError, corporateAuthClient } from "@/lib/api/corporate-auth-client";
import { clearStaffSessionCookie } from "@/lib/auth-staff-cookie";
import { useStaffAuthStore } from "@/stores/staff-auth-store";

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

/**
 * Heartbeat de sessão staff: consulta GET /api/auth/health periodicamente
 * para renovar JWT via cookie HttpOnly e detectar logout silencioso (401).
 */
export function useStaffSession(intervalMs = 60_000): void {
  const pathname = usePathname();
  const router = useRouter();
  const lockRef = useRef(false);

  useEffect(() => {
    if (!isStaffArea(pathname)) return;

    const runHealthcheck = async () => {
      if (lockRef.current) return;
      lockRef.current = true;
      try {
        await corporateAuthClient.checkHealth();
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          useStaffAuthStore.getState().clear();
          clearStaffSessionCookie();
          router.replace("/login/staff");
        }
        /* Erros de rede ou 5xx: ignorar silenciosamente — não deslogar */
      } finally {
        lockRef.current = false;
      }
    };

    void runHealthcheck();
    const id = window.setInterval(() => {
      void runHealthcheck();
    }, intervalMs);

    return () => {
      window.clearInterval(id);
    };
  }, [pathname, router, intervalMs]);
}
