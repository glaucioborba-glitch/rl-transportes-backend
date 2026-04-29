"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, staffJson, staffTryJson } from "@/lib/api/staff-client";
import { buildOperationalSnapshot } from "@/lib/ai-console/operational-snapshot";

async function staffOptionalForbidden<T>(path: string): Promise<T | null> {
  try {
    return await staffJson<T>(path);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 403 || e.status === 404)) return null;
    throw e;
  }
}

function periodo14d(): { di: string; df: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 14);
  return { di: start.toISOString().slice(0, 10), df: end.toISOString().slice(0, 10) };
}

export type SdtOperationalBundle = {
  dash: Record<string, unknown> | null;
  perf: Record<string, unknown> | null;
  cap: Record<string, unknown> | null;
  proj: Record<string, unknown> | null;
  rel: Record<string, unknown> | null;
  gar: import("@/lib/ai-console/operational-snapshot").IaGargaloBlob;
  turnos: Record<string, unknown> | null;
  prevNote: boolean;
  updatedAt: number;
  error?: string;
};

async function loadOperational(includeTurnos: boolean): Promise<Omit<SdtOperationalBundle, "updatedAt" | "error">> {
  const { di, df } = periodo14d();
  const turnosPromise = includeTurnos
    ? staffOptionalForbidden<Record<string, unknown>>(`/simulador/turnos`)
    : Promise.resolve(null);

  const [dash, perf, cap, proj, rel, gar, alternativePrev, turnos] = await Promise.all([
    staffJson<Record<string, unknown>>(`/dashboard?dataInicio=${di}&dataFim=${df}`),
    staffJson<Record<string, unknown>>(`/dashboard-performance?dataInicio=${di}&dataFim=${df}`),
    staffTryJson<Record<string, unknown>>(`/simulador/capacidade`),
    staffTryJson<Record<string, unknown>>(`/simulador/projecao-saturacao`),
    staffTryJson<Record<string, unknown>>(`/relatorios/operacional/solicitacoes?dataInicio=${di}&dataFim=${df}`),
    staffTryJson<{ horizontes?: unknown[] }>(`/ia/gargalos`),
    staffTryJson<unknown>(`/ia-operacional/previsoes`),
    turnosPromise,
  ]);
  return {
    dash,
    perf,
    cap,
    proj: proj ?? null,
    rel: rel ?? null,
    gar,
    turnos,
    prevNote: Boolean(alternativePrev),
  };
}

/** pollMs `null` = apenas refresh manual */
export function useSdtBundle(pollMs: number | null, options?: { includeTurnos?: boolean }) {
  const includeTurnos = options?.includeTurnos ?? false;
  const [bundle, setBundle] = useState<SdtOperationalBundle | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const b = await loadOperational(includeTurnos);
      setBundle({ ...b, updatedAt: Date.now() });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Falha telemetria SDT";
      setBundle((prev) => ({
        ...(prev ?? {
          dash: null,
          perf: null,
          cap: null,
          proj: null,
          rel: null,
          gar: null,
          turnos: null,
          prevNote: false,
          updatedAt: 0,
        }),
        error: msg,
      }));
    }
  }, [includeTurnos]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (pollMs == null || pollMs <= 0) return;
    timer.current = setInterval(() => void refresh(), pollMs);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [pollMs, refresh]);

  const snap = bundle
    ? buildOperationalSnapshot({ dash: bundle.dash, perf: bundle.perf, cap: bundle.cap, proj: bundle.proj, rel: bundle.rel })
    : null;

  return { bundle, snap, refresh };
}
