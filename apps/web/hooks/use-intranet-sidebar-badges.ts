"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, staffGateCockpit } from "@/lib/api/staff-client";
import { GATE_POLLING_INTERVAL_MS } from "@/lib/dev-performance";
import type { IntranetModuleId } from "@/lib/intranet/intranet-nav-config";
import { usePendenciasCadastroCount } from "@/stores/pendencias-cadastro-store";

export function useIntranetSidebarBadges(moduleId: IntranetModuleId) {
  const pendencias = usePendenciasCadastroCount();
  const [gateBadges, setGateBadges] = useState<Record<string, number>>({});

  const refreshGate = useCallback(async () => {
    if (moduleId !== "gate") return;
    try {
      const data = await staffGateCockpit();
      setGateBadges({
        "gate.fila": data.filaChegada.length,
        "gate.operacao": data.operacaoAtiva.length,
        "gate.patio": data.patio.unidades.length,
        "gate.despacho": data.despacho.length,
        "gate.os": data.ordensServico.length,
        "gate.autorizacoes": data.dashboard.autorizacoesPendentes.total,
      });
    } catch (e) {
      if (!(e instanceof ApiError)) return;
    }
  }, [moduleId]);

  useEffect(() => {
    void refreshGate();
    if (moduleId !== "gate") return;
    const id = window.setInterval(() => void refreshGate(), GATE_POLLING_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [moduleId, refreshGate]);

  function resolveBadge(key?: string): number | undefined {
    if (!key) return undefined;
    if (key === "financeiro.pendencias") return pendencias > 0 ? pendencias : undefined;
    const n = gateBadges[key];
    return n && n > 0 ? n : undefined;
  }

  return { resolveBadge };
}
