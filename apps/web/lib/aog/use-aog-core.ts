"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { ApiError, staffJson, staffTryJson } from "@/lib/api/staff-client";
import { mapAuditoriaPayload } from "@/lib/grc/auditoria-map";
import { buildOperationalSnapshot } from "@/lib/ai-console/operational-snapshot";

function periodo(d: number): { di: string; df: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - d);
  return { di: start.toISOString().slice(0, 10), df: end.toISOString().slice(0, 10) };
}

export type AogCoreBundle = {
  dash: Record<string, unknown> | null;
  perf: Record<string, unknown> | null;
  audit: unknown;
  rel: Record<string, unknown> | null;
  fin: Record<string, unknown> | null;
  prevNote: boolean;
  gar: import("@/lib/ai-console/operational-snapshot").IaGargaloBlob;
  updatedAt: number;
  error?: string;
};

async function load(): Promise<Omit<AogCoreBundle, "updatedAt" | "error">> {
  const { di, df } = periodo(14);
  const { di: pi, df: pf } = periodo(90);
  const [dash, perf, audit, rel, fin, prev, gar] = await Promise.all([
    staffJson<Record<string, unknown>>(`/dashboard?dataInicio=${di}&dataFim=${df}`),
    staffJson<Record<string, unknown>>(`/dashboard-performance?dataInicio=${di}&dataFim=${df}`),
    staffJson<unknown>(`/auditoria?limit=150&order=desc`).catch(() => ({ data: [] })),
    staffTryJson<Record<string, unknown>>(`/relatorios/operacional/solicitacoes?dataInicio=${di}&dataFim=${df}`),
    staffJson<Record<string, unknown>>(`/dashboard-financeiro?periodoInicio=${pi}&periodoFim=${pf}`).catch(() => null),
    staffTryJson<unknown>(`/ia-operacional/previsoes`),
    staffTryJson<{ horizontes?: unknown[] }>(`/ia/gargalos`),
  ]);
  return {
    dash,
    perf,
    audit,
    rel,
    fin,
    prevNote: Boolean(prev),
    gar,
  };
}

export function useAogCore(pollMs = 25_000) {
  const [bundle, setBundle] = useState<AogCoreBundle | null>(null);

  const refresh = useCallback(async () => {
    try {
      const b = await load();
      setBundle({ ...b, updatedAt: Date.now() });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Falha AOG core";
      setBundle((prev) => ({
        ...(prev ?? {
          dash: null,
          perf: null,
          audit: { data: [] },
          rel: null,
          fin: null,
          prevNote: false,
          gar: null,
          updatedAt: 0,
        }),
        error: msg,
      }));
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), pollMs);
    return () => clearInterval(t);
  }, [refresh, pollMs]);

  const snap = useMemo(() => {
    if (!bundle?.dash) return null;
    return buildOperationalSnapshot({
      dash: bundle.dash,
      perf: bundle.perf,
      cap: null,
      proj: null,
      rel: bundle.rel,
    });
  }, [bundle]);

  const auditRows = useMemo(() => mapAuditoriaPayload(bundle?.audit), [bundle?.audit]);

  return { bundle, snap, auditRows, refresh };
}
