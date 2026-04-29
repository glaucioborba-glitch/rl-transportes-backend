"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { ApiError, staffJson, staffTryJson } from "@/lib/api/staff-client";
import { buildCenarioQuery } from "@/lib/digital-twin/cenario-qs";
import { buildOperationalSnapshot } from "@/lib/ai-console/operational-snapshot";
import { staffOptionalForbidden } from "@/lib/aog/staff-optional";

function periodo14d(): { di: string; df: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 14);
  return { di: start.toISOString().slice(0, 10), df: end.toISOString().slice(0, 10) };
}

function periodo90d(): { di: string; df: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 90);
  return { di: start.toISOString().slice(0, 10), df: end.toISOString().slice(0, 10) };
}

export type AogRegulationBundle = {
  dash: Record<string, unknown> | null;
  perf: Record<string, unknown> | null;
  cap: Record<string, unknown> | null;
  cenario: Record<string, unknown> | null;
  rec: Record<string, unknown> | null;
  prevNote: boolean;
  gar: import("@/lib/ai-console/operational-snapshot").IaGargaloBlob;
  updatedAt: number;
  error?: string;
};

async function load(): Promise<Omit<AogRegulationBundle, "updatedAt" | "error">> {
  const { di, df } = periodo14d();
  const { di: pi, df: pf } = periodo90d();
  const cq = buildCenarioQuery({});
  const [dash, perf, cap, cenario, rec, prev, gar] = await Promise.all([
    staffJson<Record<string, unknown>>(`/dashboard?dataInicio=${di}&dataFim=${df}`),
    staffJson<Record<string, unknown>>(`/dashboard-performance?dataInicio=${di}&dataFim=${df}`),
    staffOptionalForbidden<Record<string, unknown>>(`/simulador/capacidade`),
    staffOptionalForbidden<Record<string, unknown>>(`/simulador/cenario${cq}`),
    staffJson<Record<string, unknown>>(`/comercial/recomendacoes?dataInicio=${pi}&dataFim=${pf}`).catch(() => null),
    staffTryJson<unknown>(`/ia-operacional/previsoes`),
    staffTryJson<{ horizontes?: unknown[] }>(`/ia/gargalos`),
  ]);
  return {
    dash,
    perf,
    cap,
    cenario,
    rec: rec ?? null,
    prevNote: Boolean(prev),
    gar,
  };
}

export function useAogRegulation(pollMs = 35_000) {
  const [bundle, setBundle] = useState<AogRegulationBundle | null>(null);

  const refresh = useCallback(async () => {
    try {
      const b = await load();
      setBundle({ ...b, updatedAt: Date.now() });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Falha AOG self-regulation";
      setBundle((prev) => ({
        ...(prev ?? {
          dash: null,
          perf: null,
          cap: null,
          cenario: null,
          rec: null,
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
      cap: bundle.cap,
      proj: null,
      rel: null,
    });
  }, [bundle]);

  return { bundle, snap, refresh };
}
