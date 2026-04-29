"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  fetchAuthMe,
  fetchCliente,
  fetchCxFinanceiroBoletos,
  fetchCxFinanceiroNfse,
  fetchKpis,
  fetchSlas,
  fetchSolicitacoesPaginated,
  type SolicitacaoRow,
} from "@/lib/api/portal-client";
import type { KpisResponse, SlasResponse } from "@/lib/api/types";
import { usePortalAuthStore } from "@/stores/portal-store";
import type { PortalUser } from "@/stores/portal-store";

export type DashboardFinanceCounts = {
  faturasEmAberto: number;
  boletosAbertosOuVencidos: number;
  nfseEmitidasAmostra: number;
};

export type DashboardData = {
  kpis: KpisResponse;
  slas: SlasResponse;
  tracking: SolicitacaoRow[];
  recent: {
    items: SolicitacaoRow[];
    total: number;
    page: number;
    limit: number;
  };
  solicitacoesHoje: SolicitacaoRow[];
  pendenciasFinanceiras: number;
  financeCounts: DashboardFinanceCounts;
};

function boletoNaoPago(b: Record<string, unknown>): boolean {
  return String(b.statusPagamento ?? "").toLowerCase() !== "pago";
}

function boletoAbertoOuVencido(b: Record<string, unknown>): boolean {
  const st = String(b.statusPagamento ?? "").toLowerCase();
  return st === "pendente" || st === "vencido";
}

function todayRangeUtc() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const from = `${y}-${m}-${day}T00:00:00.000Z`;
  const to = `${y}-${m}-${day}T23:59:59.999Z`;
  return { from, to };
}

export function usePortalDashboard(opts: { recentPage: number; recentLimit?: number }) {
  const { recentPage, recentLimit = 8 } = opts;
  const revision = usePortalAuthStore((s) => s.dashboardRevision);
  const setClienteNome = usePortalAuthStore((s) => s.setClienteNome);
  const setUser = usePortalAuthStore((s) => s.setUser);

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { from: dayFrom, to: dayTo } = todayRangeUtc();

      const [trackRes, recentRes, hojeRes, kpis, slas, cxBoletos, cxNfse] = await Promise.all([
        fetchSolicitacoesPaginated({
          page: 1,
          limit: 5,
          orderBy: "createdAt",
          order: "desc",
        }),
        fetchSolicitacoesPaginated({
          page: recentPage,
          limit: recentLimit,
          orderBy: "createdAt",
          order: "desc",
        }),
        fetchSolicitacoesPaginated({
          page: 1,
          limit: 100,
          createdFrom: dayFrom,
          createdTo: dayTo,
          orderBy: "createdAt",
          order: "desc",
        }),
        fetchKpis(),
        fetchSlas(),
        fetchCxFinanceiroBoletos(),
        fetchCxFinanceiroNfse(),
      ]);

      try {
        const me = await fetchAuthMe();
        const u: PortalUser = {
          id: me.id,
          email: me.email,
          role: me.role,
          permissions: me.permissions,
          clienteId: me.clienteId ?? null,
        };
        setUser(u);
        const cid = u.clienteId;
        if (cid) {
          try {
            const c = await fetchCliente(cid);
            const nome = typeof c.nome === "string" ? c.nome : null;
            setClienteNome(nome);
          } catch {
            /* nome opcional */
          }
        }
      } catch {
        /* sessão ainda pode exibir KPIs se /me falhar por rede */
      }

      const trackItems = trackRes.items ?? [];
      const recentItems = recentRes.items ?? [];
      const recentTotal = recentRes.total ?? recentRes.meta?.total ?? recentItems.length;
      const hojeItems = hojeRes.items ?? [];

      const pendenciasFinanceiras = cxBoletos.filter(boletoNaoPago).length;
      const boletosAbertosOuVencidos = cxBoletos.filter(boletoAbertoOuVencido).length;

      setData({
        kpis,
        slas,
        tracking: trackItems,
        recent: {
          items: recentItems,
          total: recentTotal,
          page: recentRes.page ?? recentPage,
          limit: recentRes.limit ?? recentLimit,
        },
        solicitacoesHoje: hojeItems,
        pendenciasFinanceiras,
        financeCounts: {
          faturasEmAberto: kpis.valores.faturamento_aberto,
          boletosAbertosOuVencidos,
          nfseEmitidasAmostra: cxNfse.length,
        },
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erro ao carregar dashboard");
    } finally {
      setLoading(false);
    }
  }, [recentLimit, recentPage, revision, setClienteNome, setUser]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, reload: load };
}
