"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

export type AgiSelfCorrectingBundle = {
  dash: Record<string, unknown> | null;
  perf: Record<string, unknown> | null;
  cap: Record<string, unknown> | null;
  cenario: Record<string, unknown> | null;
  prev: unknown;
  prevNote: boolean;
  updatedAt: number;
  error?: string;
};

async function load(): Promise<Omit<AgiSelfCorrectingBundle, "updatedAt" | "error">> {
  const { di, df } = periodo14d();
  const cq = buildCenarioQuery({});
  const [dash, perf, cap, cenario, prev] = await Promise.all([
    staffJson<Record<string, unknown>>(`/dashboard?dataInicio=${di}&dataFim=${df}`),
    staffJson<Record<string, unknown>>(`/dashboard-performance?dataInicio=${di}&dataFim=${df}`),
    staffOptionalForbidden<Record<string, unknown>>(`/simulador/capacidade`),
    staffOptionalForbidden<Record<string, unknown>>(`/simulador/cenario${cq}`),
    staffTryJson<unknown>(`/ia-operacional/previsoes`),
  ]);
  return {
    dash,
    perf,
    cap,
    cenario,
    prev,
    prevNote: Boolean(prev),
  };
}

export function useAgiSelfCorrecting(pollMs = 32_000) {
  const [bundle, setBundle] = useState<AgiSelfCorrectingBundle | null>(null);

  const refresh = useCallback(async () => {
    try {
      const b = await load();
      setBundle({ ...b, updatedAt: Date.now() });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Falha AGI self-correcting";
      setBundle((prev) => ({
        ...(prev ?? {
          dash: null,
          perf: null,
          cap: null,
          cenario: null,
          prev: null,
          prevNote: false,
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
