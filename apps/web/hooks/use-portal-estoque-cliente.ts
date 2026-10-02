"use client";

import { useEffect, useState } from "react";
import {
  fetchPatioUnidadesEstoque,
  type PortalPatioSaldoItem,
} from "@/lib/api/portal-client";

export function usePortalEstoqueCliente(enabled: boolean) {
  const [items, setItems] = useState<PortalPatioSaldoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setError(null);
      setLoading(false);
      setReady(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setReady(false);
    setError(null);
    void fetchPatioUnidadesEstoque()
      .then((res) => {
        if (!cancelled) setItems(res.items ?? []);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setItems([]);
          setError(e instanceof Error ? e.message : "Falha ao carregar estoque do cliente");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { items, loading, error, ready };
}
