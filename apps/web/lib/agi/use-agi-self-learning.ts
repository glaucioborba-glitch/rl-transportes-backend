"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, staffJson, staffTryJson } from "@/lib/api/staff-client";
import { buildOperationalSnapshot } from "@/lib/ai-console/operational-snapshot";

function periodo(d: number): { di: string; df: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - d);
  return { di: start.toISOString().slice(0, 10), df: end.toISOString().slice(0, 10) };
}

export type AgiSelfLearningBundle = {
  dash: Record<string, unknown> | null;
  perf: Record<string, unknown> | null;
  prev: unknown;
  rel: Record<string, unknown> | null;
  fin: Record<string, unknown> | null;
  prevNote: boolean;
  updatedAt: number;
  error?: string;
};

async function load(): Promise<Omit<AgiSelfLearningBundle, "updatedAt" | "error">> {
  const { di, df } = periodo(14);
  const { di: pi, df: pf } = periodo(90);
  const [dash, perf, prev, rel, fin] = await Promise.all([
    staffJson<Record<string, unknown>>(`/dashboard?dataInicio=${di}&dataFim=${df}`),
    staffJson<Record<string, unknown>>(`/dashboard-performance?dataInicio=${di}&dataFim=${df}`),
    staffTryJson<unknown>(`/ia-operacional/previsoes`),
    staffTryJson<Record<string, unknown>>(`/relatorios/operacional/solicitacoes?dataInicio=${di}&dataFim=${df}`),
    staffJson<Record<string, unknown>>(`/dashboard-financeiro?periodoInicio=${pi}&periodoFim=${pf}`).catch(() => null),
  ]);
  return {
    dash,
    perf,
    prev,
    rel,
    fin,
    prevNote: Boolean(prev),
  };
}

export function useAgiSelfLearning(pollMs = 28_000) {
  const [bundle, setBundle] = useState<AgiSelfLearningBundle | null>(null);

  const refresh = useCallback(async () => {
    try {
      const b = await load();
      setBundle({ ...b, updatedAt: Date.now() });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Falha AGI self-learning";
      setBundle((prev) => ({
        ...(prev ?? {
          dash: null,
          perf: null,
          prev: null,
          rel: null,
          fin: null,
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
      cap: null,
      proj: null,
      rel: bundle.rel,
    });
  }, [bundle]);

  return { bundle, snap, refresh };
}
