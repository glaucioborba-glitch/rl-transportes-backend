"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, staffListarSolicitacoesV2, staffPatioInventario } from "@/lib/api/staff-client";
import { contarPendenciasContaCorrente } from "@/lib/api/conta-corrente-client";
import {
  fetchControleEntradaSaidaCount,
  fetchGateNotificacoesNaoLidas,
} from "@/lib/gate/operacao-api";
import { GATE_POLLING_INTERVAL_MS } from "@/lib/dev-performance";
import type { IntranetModuleId } from "@/lib/intranet/intranet-nav-config";
import { usePendenciasCadastroCount } from "@/stores/pendencias-cadastro-store";

export function useIntranetSidebarBadges(moduleId: IntranetModuleId) {
  const pendencias = usePendenciasCadastroCount();
  const [gateBadges, setGateBadges] = useState<Record<string, number>>({});
  const [contaCorrentePendencias, setContaCorrentePendencias] = useState(0);

  const refreshGate = useCallback(async () => {
    if (moduleId !== "gate") return;
    try {
      const [patio, pendente, analise, controle, notificacoes] = await Promise.all([
        staffPatioInventario().catch(() => ({ lotacaoTotal: 0 })),
        staffListarSolicitacoesV2({ status: "PENDENTE", limit: 1, page: 1 }).catch(() => ({ total: 0 })),
        staffListarSolicitacoesV2({ status: "EM_ANALISE", limit: 1, page: 1 }).catch(() => ({ total: 0 })),
        fetchControleEntradaSaidaCount().catch(() => ({ count: 0 })),
        fetchGateNotificacoesNaoLidas().catch(() => ({ count: 0 })),
      ]);
      setGateBadges({
        "gate.patio": patio.lotacaoTotal,
        "gate.autorizacoes": (pendente.total ?? 0) + (analise.total ?? 0),
        "gate.controle": controle.count,
        "gate.notificacoes": notificacoes.count,
      });
    } catch (e) {
      if (!(e instanceof ApiError)) return;
    }
  }, [moduleId]);

  const refreshFinanceiro = useCallback(async () => {
    if (moduleId !== "financeiro") return;
    try {
      const out = await contarPendenciasContaCorrente();
      setContaCorrentePendencias(out.count ?? 0);
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

  useEffect(() => {
    void refreshFinanceiro();
    if (moduleId !== "financeiro") return;
    const id = window.setInterval(() => void refreshFinanceiro(), GATE_POLLING_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [moduleId, refreshFinanceiro]);

  function resolveBadge(key?: string): number | undefined {
    if (!key) return undefined;
    if (key === "financeiro.pendencias") return pendencias > 0 ? pendencias : undefined;
    if (key === "financeiro.contaCorrente") {
      return contaCorrentePendencias > 0 ? contaCorrentePendencias : undefined;
    }
    const n = gateBadges[key];
    return n && n > 0 ? n : undefined;
  }

  return { resolveBadge };
}
