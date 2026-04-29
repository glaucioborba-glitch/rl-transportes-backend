"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, staffJson, staffTryJson } from "@/lib/api/staff-client";
import { buildOperationalSnapshot } from "@/lib/ai-console/operational-snapshot";
import { toast } from "@/lib/toast";

const POLL_MS = 10_000;

function periodo14d(): { di: string; df: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 14);
  return { di: start.toISOString().slice(0, 10), df: end.toISOString().slice(0, 10) };
}

export type OperationalConsoleBundle = {
  dash: Record<string, unknown> | null;
  perf: Record<string, unknown> | null;
  cap: Record<string, unknown> | null;
  proj: Record<string, unknown> | null;
  rel: Record<string, unknown> | null;
  gar: { horizontes?: unknown[] } | null;
  prevNote: boolean;
  updatedAt: number;
  error?: string;
};

async function loadBundle(): Promise<Omit<OperationalConsoleBundle, "updatedAt" | "error">> {
  const { di, df } = periodo14d();
  const [dash, perf, cap, proj, rel, gar, alternativePrev] = await Promise.all([
    staffJson<Record<string, unknown>>(`/dashboard?dataInicio=${di}&dataFim=${df}`),
    staffJson<Record<string, unknown>>(`/dashboard-performance?dataInicio=${di}&dataFim=${df}`),
    staffTryJson<Record<string, unknown>>(`/simulador/capacidade`),
    staffTryJson<Record<string, unknown>>(`/simulador/projecao-saturacao`),
    staffTryJson<Record<string, unknown>>(`/relatorios/operacional/solicitacoes?dataInicio=${di}&dataFim=${df}`),
    staffTryJson<{ horizontes?: unknown[] }>(`/ia/gargalos`),
    staffTryJson<unknown>(`/ia-operacional/previsoes`),
  ]);
  return {
    dash,
    perf,
    cap,
    proj: proj ?? null,
    rel: rel ?? null,
    gar,
    prevNote: Boolean(alternativePrev),
  };
}

export function useOperationalAiConsole(enabled = true) {
  const [bundle, setBundle] = useState<OperationalConsoleBundle | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const b = await loadBundle();
      setBundle({ ...b, updatedAt: Date.now() });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Falha ao carregar AI Console operacional";
      toast.error(msg);
      setBundle((prev) => ({
        ...(prev ?? {
          dash: null,
          perf: null,
          cap: null,
          proj: null,
          rel: null,
          gar: null,
          prevNote: false,
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

  const snap = bundle ? buildOperationalSnapshot({ dash: bundle.dash, perf: bundle.perf, cap: bundle.cap, proj: bundle.proj, rel: bundle.rel }) : null;

  return { bundle, snap, refresh };
}
