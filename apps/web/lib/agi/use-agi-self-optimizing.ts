"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, staffJson } from "@/lib/api/staff-client";
import { buildCenarioQuery, buildExpansaoQuery } from "@/lib/digital-twin/cenario-qs";
import { syntheticOperationalFromPerfCap } from "@/lib/agi/synthetic-operational";
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

export type AgiSelfOptimizingBundle = {
  expansao: Record<string, unknown> | null;
  cenario: Record<string, unknown> | null;
  cap: Record<string, unknown> | null;
  perf: Record<string, unknown> | null;
  fin: Record<string, unknown> | null;
  rec: Record<string, unknown> | null;
  updatedAt: number;
  error?: string;
};

async function load(): Promise<Omit<AgiSelfOptimizingBundle, "updatedAt" | "error">> {
  const { di, df } = periodo14d();
  const { di: pi, df: pf } = periodo90d();
  const eq = buildExpansaoQuery({});
  const cq = buildCenarioQuery({});
  const [expansao, cenario, cap, perf, fin, rec] = await Promise.all([
    staffOptionalForbidden<Record<string, unknown>>(`/simulador/expansao${eq}`),
    staffOptionalForbidden<Record<string, unknown>>(`/simulador/cenario${cq}`),
    staffOptionalForbidden<Record<string, unknown>>(`/simulador/capacidade`),
    staffJson<Record<string, unknown>>(`/dashboard-performance?dataInicio=${di}&dataFim=${df}`),
    staffJson<Record<string, unknown>>(`/dashboard-financeiro?periodoInicio=${pi}&periodoFim=${pf}`).catch(() => null),
    staffJson<Record<string, unknown>>(`/comercial/recomendacoes?dataInicio=${pi}&dataFim=${pf}`).catch(() => null),
  ]);
  return {
    expansao,
    cenario,
    cap,
    perf,
    fin,
    rec: rec ?? null,
  };
}

export function useAgiSelfOptimizing(pollMs = 34_000) {
  const [bundle, setBundle] = useState<AgiSelfOptimizingBundle | null>(null);

  const refresh = useCallback(async () => {
    try {
      const b = await load();
      setBundle({ ...b, updatedAt: Date.now() });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Falha AGI self-optimizing";
      setBundle((prev) => ({
        ...(prev ?? {
          expansao: null,
          cenario: null,
          cap: null,
          perf: null,
          fin: null,
          rec: null,
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

  /** Snapshot só de performance + capacidade (rotas do módulo não incluem /dashboard). */
  const snap = useMemo(() => {
    if (!bundle?.perf) return null;
    return syntheticOperationalFromPerfCap(bundle.perf, bundle.cap);
  }, [bundle]);

  return { bundle, snap, refresh };
}
