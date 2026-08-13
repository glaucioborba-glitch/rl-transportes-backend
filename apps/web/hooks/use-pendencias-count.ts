"use client";

import { useCallback, useEffect } from "react";
import { fetchPendenciasCadastroCount } from "@/lib/api/cadastro-financeiro-client";
import { canPollPendenciasCadastro } from "@/lib/financeiro/pendencias-cadastro-access";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { usePendenciasCadastroStore } from "@/stores/pendencias-cadastro-store";

const POLL_MS = 30_000;

/** Polling global (30s) do total de cadastros pendentes de análise financeira. */
export function usePendenciasCount() {
  const user = useStaffAuthStore((s) => s.user);
  const setCount = usePendenciasCadastroStore((s) => s.setCount);
  const reset = usePendenciasCadastroStore((s) => s.reset);
  const enabled = canPollPendenciasCadastro(user);

  const refresh = useCallback(async () => {
    if (!enabled) {
      reset();
      return;
    }
    try {
      const count = await fetchPendenciasCadastroCount();
      setCount(count);
    } catch {
      /* silencioso — badge opcional */
    }
  }, [enabled, reset, setCount]);

  useEffect(() => {
    if (!enabled) {
      reset();
      return;
    }
    void refresh();
    const id = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(id);
  }, [enabled, refresh, reset]);

  return { refresh, enabled };
}
