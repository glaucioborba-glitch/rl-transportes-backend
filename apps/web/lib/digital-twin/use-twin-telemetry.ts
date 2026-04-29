"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, staffJson, staffTryJson } from "@/lib/api/staff-client";
import { toast } from "@/lib/toast";

const POLL_MS = 8000;

export type TwinPollBundle = {
  dash: Record<string, unknown> | null;
  perf: Record<string, unknown> | null;
  cap: Record<string, unknown> | null;
  proj: Record<string, unknown> | null;
  rel: Record<string, unknown> | null;
  updatedAt: number;
  error?: string;
};

function periodo(): { di: string; df: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 14);
  return { di: start.toISOString().slice(0, 10), df: end.toISOString().slice(0, 10) };
}

async function fetchTwinBundle(): Promise<Omit<TwinPollBundle, "updatedAt" | "error">> {
  const { di, df } = periodo();
  const [dash, perf, cap, proj, rel] = await Promise.all([
    staffJson<Record<string, unknown>>(`/dashboard?dataInicio=${di}&dataFim=${df}`),
    staffJson<Record<string, unknown>>(`/dashboard-performance?dataInicio=${di}&dataFim=${df}`),
    staffTryJson<Record<string, unknown>>(`/simulador/capacidade`),
    staffTryJson<Record<string, unknown>>(`/simulador/projecao-saturacao`),
    staffTryJson<Record<string, unknown>>(`/relatorios/operacional/solicitacoes?dataInicio=${di}&dataFim=${df}`).catch(() => null),
  ]);
  return { dash, perf, cap, proj, rel: rel ?? null };
}

export function useTwinTelemetry(enabled = true) {
  const [bundle, setBundle] = useState<TwinPollBundle | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const b = await fetchTwinBundle();
      setBundle({ ...b, updatedAt: Date.now() });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Falha telemetria twin";
      toast.error(msg);
      setBundle((prev) => ({
        ...(prev ?? { dash: null, perf: null, cap: null, proj: null, rel: null, updatedAt: 0 }),
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

  return { bundle, refresh };
}
