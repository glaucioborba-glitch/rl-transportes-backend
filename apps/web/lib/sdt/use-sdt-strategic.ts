"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, staffJson } from "@/lib/api/staff-client";
import { buildCenarioQuery, buildExpansaoQuery } from "@/lib/digital-twin/cenario-qs";

async function staffOptionalForbidden<T>(path: string): Promise<T | null> {
  try {
    return await staffJson<T>(path);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 403 || e.status === 404)) return null;
    throw e;
  }
}

function periodo(d: number): { di: string; df: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - d);
  return { di: start.toISOString().slice(0, 10), df: end.toISOString().slice(0, 10) };
}

export type SdtStrategicBundle = {
  cap: Record<string, unknown> | null;
  perf: Record<string, unknown> | null;
  fin: Record<string, unknown> | null;
  rec: Record<string, unknown> | null;
  expansao: Record<string, unknown> | null;
  cenarioBase: Record<string, unknown> | null;
  updatedAt: number;
  error?: string;
};

async function loadStrategic(): Promise<Omit<SdtStrategicBundle, "updatedAt" | "error">> {
  const { di, df } = periodo(90);
  const cq = buildCenarioQuery({});
  const eq = buildExpansaoQuery({ quadrasAdicionais: 1 });
  const [cap, perf, fin, rec, expansao, cenarioBase] = await Promise.all([
    staffOptionalForbidden<Record<string, unknown>>(`/simulador/capacidade`),
    staffJson<Record<string, unknown>>(`/dashboard-performance?dataInicio=${di}&dataFim=${df}`),
    staffJson<Record<string, unknown>>(`/dashboard-financeiro?periodoInicio=${di}&periodoFim=${df}`),
    staffJson<Record<string, unknown>>(`/comercial/recomendacoes?dataInicio=${di}&dataFim=${df}`).catch(() => null),
    staffOptionalForbidden<Record<string, unknown>>(`/simulador/expansao${eq}`),
    staffOptionalForbidden<Record<string, unknown>>(`/simulador/cenario${cq}`),
  ]);
  return {
    cap,
    perf,
    fin,
    rec: rec ?? null,
    expansao,
    cenarioBase,
  };
}

export function useSdtStrategic(pollMs = 60_000) {
  const [bundle, setBundle] = useState<SdtStrategicBundle | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const b = await loadStrategic();
      setBundle({ ...b, updatedAt: Date.now() });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Falha SDT estratégico";
      setBundle((prev) => ({
        ...(prev ?? {
          cap: null,
          perf: null,
          fin: null,
          rec: null,
          expansao: null,
          cenarioBase: null,
          updatedAt: 0,
        }),
        error: msg,
      }));
    }
  }, []);

  useEffect(() => {
    void refresh();
    timer.current = setInterval(() => void refresh(), pollMs);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [refresh, pollMs]);

  return { bundle, refresh };
}
