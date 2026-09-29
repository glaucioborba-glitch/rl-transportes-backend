"use client";

import { useEffect, useState } from "react";
import { listPortalOrigensDestinos, type PortalLocalTransporte } from "@/lib/api/portal-client";

export function usePortalOrigensDestinos(enabled = true) {
  const [locais, setLocais] = useState<PortalLocalTransporte[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void listPortalOrigensDestinos()
      .then((res) => {
        if (!cancelled) setLocais(res.items ?? []);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setLocais([]);
          setError(e instanceof Error ? e.message : "Falha ao carregar origens e destinos");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { locais, loading, error };
}
