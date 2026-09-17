"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, staffListarSolicitacoesV2, staffPatioInventario } from "@/lib/api/staff-client";
import { fetchControleEntradaSaidaCount } from "@/lib/gate/operacao-api";
import { GATE_POLLING_INTERVAL_MS } from "@/lib/dev-performance";
import type { IntranetModuleId } from "@/lib/intranet/intranet-nav-config";
import { usePendenciasCadastroCount } from "@/stores/pendencias-cadastro-store";

export function useIntranetSidebarBadges(moduleId: IntranetModuleId) {
  const pendencias = usePendenciasCadastroCount();
  const [gateBadges, setGateBadges] = useState<Record<string, number>>({});

  const refreshGate = useCallback(async () => {
    if (moduleId !== "gate") return;
    try {
      const [patio, pendente, analise, controle] = await Promise.all([
        staffPatioInventario().catch(() => ({ lotacaoTotal: 0 })),
        staffListarSolicitacoesV2({ status: "PENDENTE", limit: 1, page: 1 }).catch(() => ({ total: 0 })),
        staffListarSolicitacoesV2({ status: "EM_ANALISE", limit: 1, page: 1 }).catch(() => ({ total: 0 })),
        fetchControleEntradaSaidaCount().catch(() => ({ count: 0 })),
      ]);
      setGateBadges({
        "gate.patio": patio.lotacaoTotal,
        "gate.autorizacoes": (pendente.total ?? 0) + (analise.total ?? 0),
        "gate.controle": controle.count,
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
