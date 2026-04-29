"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, staffJson } from "@/lib/api/staff-client";
import { toast } from "@/lib/toast";

const POLL_MS = 12_000;

export type FinanceConsoleBundle = {
  fin: Record<string, unknown> | null;
  ind: Record<string, unknown> | null;
  rec: Record<string, unknown> | null;
  perf: Record<string, unknown> | null;
  fat: Record<string, unknown> | null;
  updatedAt: number;
  error?: string;
};

async function loadFinance(): Promise<Omit<FinanceConsoleBundle, "updatedAt" | "error">> {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 90);
  const pi = start.toISOString().slice(0, 10);
  const pf = end.toISOString().slice(0, 10);
  const [fin, ind, rec, perf, fat] = await Promise.all([
    staffJson<Record<string, unknown>>(`/dashboard-financeiro?periodoInicio=${pi}&periodoFim=${pf}`),
    staffJson<Record<string, unknown>>(`/comercial/indicadores?dataInicio=${pi}&dataFim=${pf}`),
    staffJson<Record<string, unknown>>(`/comercial/recomendacoes?dataInicio=${pi}&dataFim=${pf}`).catch(() => null),
    staffJson<Record<string, unknown>>(`/dashboard-performance?dataInicio=${pi}&dataFim=${pf}`),
    staffJson<Record<string, unknown>>(`/relatorios/financeiro/faturamento?dataInicio=${pi}&dataFim=${pf}`).catch(() => null),
  ]);
  return { fin, ind, rec, perf, fat };
}

export function useFinanceAiConsole(enabled = true) {
  const [bundle, setBundle] = useState<FinanceConsoleBundle | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const b = await loadFinance();
      setBundle({ ...b, updatedAt: Date.now() });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Falha ao carregar AI Console financeiro";
      toast.error(msg);
      setBundle((prev) => ({
        ...(prev ?? { fin: null, ind: null, rec: null, perf: null, fat: null, updatedAt: 0 }),
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
