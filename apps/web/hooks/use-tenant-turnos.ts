"use client";

import { useEffect, useState } from "react";
import { fetchPortalTurnos } from "@/lib/api/portal-client";
import { fetchTenantTurnos, FALLBACK_TURNOS, type TenantTurnoConfig } from "@/lib/api/tenant-config-client";
import { useStaffAuthStore } from "@/stores/staffAuthStore";

export function useTenantTurnos(tenantIdOverride?: string) {
  const staffTenantId = useStaffAuthStore((s) => s.user?.tenantId);
  const tenantId = tenantIdOverride ?? staffTenantId ?? "default";
  const [turnos, setTurnos] = useState<TenantTurnoConfig[]>(FALLBACK_TURNOS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const portal =
      typeof window !== "undefined" &&
      (window.location.pathname.startsWith("/portal") ||
        window.location.pathname.startsWith("/cliente/portal"));
    const load = portal
      ? fetchPortalTurnos().then((rows) => (rows?.length ? rows : FALLBACK_TURNOS))
      : fetchTenantTurnos(tenantId);
    load
      .then((rows) => {
        if (!cancelled) setTurnos(rows);
      })
      .catch(() => {
        if (!cancelled) setTurnos(FALLBACK_TURNOS);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  return { turnos, loading, tenantId };
}
