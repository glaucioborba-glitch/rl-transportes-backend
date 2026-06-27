"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  ensurePortalPessoaSessionForPortal,
  fetchPortalDashboard,
  inferPortalClienteTipo,
  portalAuthBootstrap,
  type SolicitacaoRow,
} from "@/lib/api/portal-client";
import type { KpisResponse, SlasResponse } from "@/lib/api/types";
import { hasPortalClientSession } from "@/lib/portal-auth-mode";
import { usePortalClienteAuthStore } from "@/stores/portalClienteAuthStore";
import { usePortalAuthStore } from "@/stores/portal-store";
import { usePessoaAutorizadaStore } from "@/stores/pessoaAutorizadaStore";

export type DashboardFinanceCounts = {
  faturasEmAberto: number;
  boletosAbertosOuVencidos: number;
  nfseEmitidasAmostra: number;
  faturadoMes: number;
};

export type DashboardData = {
  kpis: KpisResponse;
  slas: SlasResponse;
  slaDesempenho: number;
  slaCumpridos: number;
  slaViolados: number;
  unidades: {
    total: number;
    import: number;
    export: number;
    gateIn: number;
    gateOut: number;
  };
  tendencias: {
    solicitacoesMesVsAnteriorPct: number;
    faturadoMesVsAnteriorPct: number;
  };
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

export function usePortalDashboard(opts: { recentPage: number; recentLimit?: number }) {
  const router = useRouter();
  const { recentPage, recentLimit = 8 } = opts;
  const revision = usePortalAuthStore((s) => s.dashboardRevision);
  const accessToken = usePortalAuthStore((s) => s.accessToken);
  const sessionHydrated = usePortalAuthStore((s) => s.sessionHydrated);
  const portalUser = usePortalAuthStore((s) => s.user);
  const hasSession = hasPortalClientSession({ accessToken, sessionHydrated, user: portalUser });
  const setCliente = usePortalAuthStore((s) => s.setCliente);
  const setUser = usePortalAuthStore((s) => s.setUser);
  const setBloqueioFinanceiro = usePortalClienteAuthStore((s) => s.setBloqueioFinanceiro);
  const pessoaId = usePessoaAutorizadaStore((s) => s.pessoa?.id ?? null);

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [awaitingPessoa, setAwaitingPessoa] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAwaitingPessoa(false);

    if (!hasSession) {
      setLoading(false);
      setError("Sessão expirada. Faça login novamente.");
      return;
    }

    if (!pessoaId) {
      const tipo = portalUser?.tipo ?? inferPortalClienteTipo(portalUser);
      if (tipo === "PF" && portalUser?.cpfCnpj) {
        const ensured = await ensurePortalPessoaSessionForPortal({
          cpfCnpj: portalUser.cpfCnpj,
          force: true,
        });
        if (ensured.status === "error") {
          setError(ensured.message);
          setLoading(false);
          return;
        }
        if (ensured.status === "need-select") {
          setAwaitingPessoa(true);
          setLoading(false);
          router.replace(
            `/portal/auth/select-pessoa?next=${encodeURIComponent("/portal/dashboard")}`,
          );
          return;
        }
      } else {
        try {
          const boot = await portalAuthBootstrap();
          if (boot.precisaSelecionarPessoa) {
            setAwaitingPessoa(true);
            setLoading(false);
            router.replace(
              `/portal/auth/select-pessoa?next=${encodeURIComponent("/portal/dashboard")}`,
            );
            return;
          }
        } catch {
          setAwaitingPessoa(true);
          setLoading(false);
          router.replace(
            `/portal/auth/select-pessoa?next=${encodeURIComponent("/portal/dashboard")}`,
          );
          return;
        }
      }
    }

    const pessoaAtual = usePessoaAutorizadaStore.getState().pessoa?.id;
    if (!pessoaAtual) {
      setLoading(false);
      return;
    }

    try {
      const dash = await fetchPortalDashboard({
        recentPage,
        recentLimit,
      });

      try {
        const u = usePortalAuthStore.getState().user;
        if (u) setUser(u);
        const c = dash.cliente;
        if (c?.id) {
          setCliente({
            id: c.id,
            nomeFantasia: null,
            razaoSocial: c.nome?.trim() || null,
            cpfCnpj: typeof c.cpfCnpj === "string" ? c.cpfCnpj : "",
          });
        }
      } catch {
        /* */
      }

      const trackingItems = (dash.trackingSample ?? []) as SolicitacaoRow[];
      const recentItems = (dash.recent?.items ?? []) as SolicitacaoRow[];
      const recentTotal = dash.recent?.total ?? recentItems.length;
      const hojeItems = (dash.solicitacoesHoje ?? []) as SolicitacaoRow[];

      const kpis = dash.kpisCx;
      const slas = dash.slasCx;

      const pendenciasFinanceiras = dash.financeiro.boletosPendentes;

      setBloqueioFinanceiro(Boolean(dash.isBloqueadoFinanceiramente));

      setData({
        kpis,
        slas,
        slaDesempenho: dash.slas?.desempenho ?? 0,
        slaCumpridos: dash.slas?.cumpridos ?? 0,
        slaViolados: dash.slas?.violados ?? 0,
        unidades: dash.unidades ?? {
          total: 0,
          import: 0,
          export: 0,
          gateIn: 0,
          gateOut: 0,
        },
        tendencias: dash.tendencias ?? {
          solicitacoesMesVsAnteriorPct: 0,
          faturadoMesVsAnteriorPct: 0,
        },
        tracking: trackingItems,
        recent: {
          items: recentItems,
          total: recentTotal,
          page: dash.recent?.page ?? recentPage,
          limit: dash.recent?.limit ?? recentLimit,
        },
        solicitacoesHoje: hojeItems,
        pendenciasFinanceiras,
        financeCounts: {
          faturasEmAberto: kpis.valores.faturamento_aberto,
          boletosAbertosOuVencidos: pendenciasFinanceiras,
          nfseEmitidasAmostra: dash.financeiro.nfseEmitidas,
          faturadoMes: dash.financeiro.faturadoMes ?? 0,
        },
      });
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error && e.message
            ? e.message
            : "Erro ao carregar dashboard";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [
    hasSession,
    pessoaId,
    portalUser,
    recentLimit,
    recentPage,
    revision,
    router,
    setCliente,
    setUser,
    setBloqueioFinanceiro,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, awaitingPessoa, reload: load };
}
