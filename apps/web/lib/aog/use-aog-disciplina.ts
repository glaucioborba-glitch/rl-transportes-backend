"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { ApiError, staffJson, staffTryJson } from "@/lib/api/staff-client";
import { mapAuditoriaPayload } from "@/lib/grc/auditoria-map";
import { countApiRecords } from "@/lib/grc/executive-kpis";

function periodo14d(): { di: string; df: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 14);
  return { di: start.toISOString().slice(0, 10), df: end.toISOString().slice(0, 10) };
}

export type AogDisciplinaBundle = {
  audit: unknown;
  usersPayload: unknown;
  perf: Record<string, unknown> | null;
  rel: Record<string, unknown> | null;
  usersCount: number | null;
  updatedAt: number;
  error?: string;
};

async function load(): Promise<Omit<AogDisciplinaBundle, "updatedAt" | "error" | "usersCount">> {
  const { di, df } = periodo14d();
  const [audit, usersPayload, perf, rel] = await Promise.all([
    staffJson<unknown>(`/auditoria?limit=200&order=desc`).catch(() => ({ data: [] })),
    staffTryJson<unknown>(`/users`),
    staffJson<Record<string, unknown>>(`/dashboard-performance?dataInicio=${di}&dataFim=${df}`),
    staffTryJson<Record<string, unknown>>(`/relatorios/operacional/solicitacoes?dataInicio=${di}&dataFim=${df}`),
  ]);
  return { audit, usersPayload, perf, rel };
}

export function useAogDisciplina(pollMs = 30_000) {
  const [bundle, setBundle] = useState<AogDisciplinaBundle | null>(null);

  const refresh = useCallback(async () => {
    try {
      const b = await load();
      setBundle({
        ...b,
        usersCount: countApiRecords(b.usersPayload),
        updatedAt: Date.now(),
      });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Falha AOG disciplina";
      setBundle((prev) => ({
        ...(prev ?? {
          audit: { data: [] },
          usersPayload: null,
          perf: null,
          rel: null,
          usersCount: null,
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

  const auditRows = useMemo(() => mapAuditoriaPayload(bundle?.audit), [bundle?.audit]);

  return { bundle, auditRows, refresh };
}
