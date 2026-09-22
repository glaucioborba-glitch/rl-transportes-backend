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
import { DEFAULT_PORTAL_HOME } from "@/lib/portal-redirect";
import { hasPortalClientSession } from "@/lib/portal-auth-mode";
import { usePortalClienteAuthStore } from "@/stores/portalClienteAuthStore";
import { usePortalAuthStore } from "@/stores/portal-store";
import { usePessoaAutorizadaStore } from "@/stores/pessoaAutorizadaStore";

export type DashboardFinanceSummary = {
  faturasEmAberto: number;
  valorEmAberto: number;
  boletosPendentes: number;
  boletosVencidos: number;
  nfseEmitidas: number;
  faturadoMes: number;
  saldoContaCorrente: number;
};

export type DashboardData = {
  solicitacoesAbertas: number;
  solicitacoesEmAndamento: number;
  unidadesNoPatio: number;
  agendamentosHoje: number;
  finance: DashboardFinanceSummary;
  tracking: SolicitacaoRow[];
  recent: {
    items: SolicitacaoRow[];
    total: number;
    page: number;
    limit: number;
  };
  solicitacoesHoje: SolicitacaoRow[];
  condicaoPagamento: string | null;
  prazoPagamento: string | null;
  condicaoPagamentoLabel: string | null;
  prazoPagamentoLabel: string | null;
  statusCadastro: "PENDENTE_ANALISE_FINANCEIRA" | "APROVADO" | "REJEITADO" | null;
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
            `/portal/auth/select-pessoa?next=${encodeURIComponent(DEFAULT_PORTAL_HOME)}`,
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
              `/portal/auth/select-pessoa?next=${encodeURIComponent(DEFAULT_PORTAL_HOME)}`,
            );
            return;
          }
        } catch {
          setAwaitingPessoa(true);
          setLoading(false);
          router.replace(
            `/portal/auth/select-pessoa?next=${encodeURIComponent(DEFAULT_PORTAL_HOME)}`,
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

      const recentItems = (dash.recent?.items ?? []) as SolicitacaoRow[];
      const recentTotal = dash.recent?.total ?? recentItems.length;
      const hojeItems = (dash.solicitacoesHoje ?? []) as SolicitacaoRow[];
      const fin = dash.financeiro;

      setBloqueioFinanceiro(Boolean(dash.isBloqueadoFinanceiramente));

      setData({
        solicitacoesAbertas: (dash.solicitacoes?.abertas ?? 0) + (dash.solicitacoes?.emAndamento ?? 0),
        solicitacoesEmAndamento: dash.solicitacoes?.emAndamento ?? 0,
        unidadesNoPatio: dash.unidadesNoPatio ?? dash.kpisCx?.valores.containers_ativos ?? 0,
        agendamentosHoje: dash.agendamentosHojeCount ?? hojeItems.length,
        finance: {
          faturasEmAberto: fin.faturasEmAberto ?? dash.kpisCx?.valores.faturamento_aberto ?? 0,
          valorEmAberto: fin.valorEmAberto ?? 0,
          boletosPendentes: fin.boletosPendentes ?? 0,
          boletosVencidos: fin.boletosVencidos ?? 0,
          nfseEmitidas: fin.nfseEmitidas ?? 0,
          faturadoMes: fin.faturadoMes ?? 0,
          saldoContaCorrente: fin.saldoContaCorrente ?? 0,
        },
        tracking: recentItems,
        recent: {
          items: recentItems,
          total: recentTotal,
          page: dash.recent?.page ?? recentPage,
          limit: dash.recent?.limit ?? recentLimit,
        },
        solicitacoesHoje: hojeItems,
        condicaoPagamento: dash.condicaoPagamento ?? null,
        prazoPagamento: dash.prazoPagamento ?? null,
        condicaoPagamentoLabel: dash.condicaoPagamentoLabel ?? null,
        prazoPagamentoLabel: dash.prazoPagamentoLabel ?? null,
        statusCadastro: dash.statusCadastro ?? null,
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
