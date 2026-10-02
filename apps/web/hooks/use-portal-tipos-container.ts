"use client";

import { useEffect, useState } from "react";
import {
  listPortalTiposContainer,
  type PortalTipoContainerCatalogItem,
} from "@/lib/api/portal-client";

export function usePortalTiposContainer(enabled = true) {
  const [tipos, setTipos] = useState<PortalTipoContainerCatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void listPortalTiposContainer()
      .then((res) => {
        if (!cancelled) setTipos(res.items ?? []);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setTipos([]);
          setError(e instanceof Error ? e.message : "Falha ao carregar tipos de contêiner");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { tipos, loading, error };
}
