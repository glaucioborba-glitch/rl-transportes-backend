"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, staffJson } from "@/lib/api/staff-client";
import { buildCenarioQuery, buildExpansaoQuery } from "@/lib/digital-twin/cenario-qs";
import { buildOperationalSnapshot } from "@/lib/ai-console/operational-snapshot";
import { toast } from "@/lib/toast";

const POLL_MS = 15_000;

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

export type StrategicConsoleBundle = {
  dash: Record<string, unknown> | null;
  perf: Record<string, unknown> | null;
  cap: Record<string, unknown> | null;
  fin: Record<string, unknown> | null;
  rec: Record<string, unknown> | null;
  cenario: Record<string, unknown> | null;
  expansao: Record<string, unknown> | null;
  gar: { horizontes?: unknown[] } | null;
  updatedAt: number;
  error?: string;
};

async function loadStrategic(): Promise<Omit<StrategicConsoleBundle, "updatedAt" | "error">> {
  const { di, df } = periodo(14);
  const { di: pi, df: pf } = periodo(90);
  const cq = buildCenarioQuery({});
  const eq = buildExpansaoQuery({ quadrasAdicionais: 1 });
  const [dash, perf, cap, fin, rec, cenario, expansao, gar] = await Promise.all([
    staffJson<Record<string, unknown>>(`/dashboard?dataInicio=${di}&dataFim=${df}`),
    staffJson<Record<string, unknown>>(`/dashboard-performance?dataInicio=${di}&dataFim=${df}`),
    staffOptionalForbidden<Record<string, unknown>>(`/simulador/capacidade`),
    staffJson<Record<string, unknown>>(`/dashboard-financeiro?periodoInicio=${pi}&periodoFim=${pf}`),
    staffJson<Record<string, unknown>>(`/comercial/recomendacoes?dataInicio=${pi}&dataFim=${pf}`).catch(() => null),
    staffOptionalForbidden<Record<string, unknown>>(`/simulador/cenario${cq}`),
    staffOptionalForbidden<Record<string, unknown>>(`/simulador/expansao${eq}`),
    staffOptionalForbidden<{ horizontes?: unknown[] }>(`/ia/gargalos`),
  ]);
  return {
    dash,
    perf,
    cap,
    fin,
    rec: rec ?? null,
    cenario,
    expansao,
    gar,
  };
}

export function useStrategicAiConsole(enabled = true) {
  const [bundle, setBundle] = useState<StrategicConsoleBundle | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const b = await loadStrategic();
      setBundle({ ...b, updatedAt: Date.now() });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Falha ao carregar AI Console estratégico";
      toast.error(msg);
      setBundle((prev) => ({
        ...(prev ?? {
          dash: null,
          perf: null,
          cap: null,
          fin: null,
          rec: null,
          cenario: null,
          expansao: null,
          gar: null,
          updatedAt: 0,
        }),
        error: msg,
      }));
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    timer.current = setInterval(() => void refresh(), POLL_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [enabled, refresh]);

  const snap = bundle
    ? buildOperationalSnapshot({
        dash: bundle.dash,
        perf: bundle.perf,
        cap: bundle.cap,
        proj: null,
        rel: null,
      })
    : null;

  return { bundle, snap, refresh };
}
