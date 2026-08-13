"use client";

import { useEffect, useState } from "react";
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
    fetchTenantTurnos(tenantId)
      .then((rows) => {
        if (!cancelled) setTurnos(rows);
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
