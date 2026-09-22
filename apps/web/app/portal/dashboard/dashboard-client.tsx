"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiCard, SectionTitle } from "@/components/portal/portal-primitives";
import { PortalTable } from "@/components/portal/portal-table";
import { StatusBadge } from "@/components/portal/status-badge";
import { SolicitacaoDirecaoBadge } from "@/components/solicitacao/solicitacao-direcao-badge";
import { usePortalDashboard } from "@/hooks/use-portal-dashboard";
import { usePortalHealth } from "@/hooks/use-portal-health";
import { formatDateTime, solicitacaoControleDisplay, solicitacaoIdOperacional } from "@/lib/portal-tracking";
import { collectSolicitacaoContainerISOs } from "@/lib/container-display";
import { ContainerNumber } from "@/components/ui/container-number";
import { PortalContainerTimelineSlideOver } from "@/components/portal/container-timeline-slideover";
import type { SolicitacaoRow } from "@/lib/api/portal-client";
import { CalendarClock, ClipboardList, Container, WalletCards } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { PORTAL_BLOQUEIO_FINANCEIRO_TOAST, PORTAL_SCHEDULING_DISABLED_CLASS } from "@/lib/portal-financeiro-block";
import {
  isLayoutFaturamentoPortal,
  isLayoutPixPortal,
  textoCondicaoVigente,
} from "@/lib/condicao-pagamento-portal";
import { formatBRL } from "@/lib/financeiro/format";
import { usePortalClienteAuthStore } from "@/stores/portalClienteAuthStore";
import { DEFAULT_PERMISSOES, usePessoaPermissoesStore } from "@/stores/pessoaPermissoesStore";
import { toast } from "@/lib/toast";

function saldoClass(saldo: number) {
  if (Math.abs(saldo) < 0.005) return "text-white";
  return saldo > 0 ? "text-emerald-400" : "text-red-400";
}

function saldoHint(saldo: number) {
  if (Math.abs(saldo) < 0.005) return "Saldo zerado";
  return saldo > 0 ? "Crédito a seu favor" : "Saldo em aberto";
}

export function PortalDashboardClient() {
  const searchParams = useSearchParams();
  const bloqueadoFin = usePortalClienteAuthStore((s) => s.isBloqueadoFinanceiramente);
  const permissoes = usePessoaPermissoesStore((s) => s.permissoes);
  const podeFinanceiro = !!(permissoes ?? DEFAULT_PERMISSOES).podeVisualizarFinanceiro;
  const [recentPage, setRecentPage] = useState(1);
  const recentLimit = 8;
  const health = usePortalHealth();
  const secOffline = health?.securityEngine === "offline";
  const secDegraded = health?.securityEngine === "degraded";
  const { data, loading, error, awaitingPessoa, reload } = usePortalDashboard({ recentPage, recentLimit });

  const [q, setQ] = useState("");
  const [timelineIso, setTimelineIso] = useState<string | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);

  function openContainerTimeline(iso: string) {
    setTimelineIso(iso);
    setTimelineOpen(true);
  }

  useEffect(() => {
    if (searchParams.get("bloqueioFinanceiro") === "1") {
      toast.error(PORTAL_BLOQUEIO_FINANCEIRO_TOAST);
    }
  }, [searchParams]);

  const filteredRecent = useMemo(() => {
    const rows = data?.recent.items ?? [];
    const qq = q.trim().toLowerCase();
    if (!qq) return rows;
    return rows.filter((s) => {
      const id = solicitacaoIdOperacional(s);
      return (
        s.protocolo.toLowerCase().includes(qq) ||
        (id && (String(id.numero).includes(qq) || id.label.toLowerCase().includes(qq))) ||
        (s.unidades ?? []).some((u) => u.numeroIso.toLowerCase().includes(qq))
      );
    });
  }, [data?.recent.items, q]);

  if (awaitingPessoa || (loading && !data)) {
    return (
      <main className="mx-auto w-[90%] space-y-6 px-4 py-8">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="mx-auto w-[90%] px-4 py-8">
        <Card className="border-red-500/30 bg-red-500/5">
          <CardHeader>
            <CardTitle className="text-red-200">Erro no painel</CardTitle>
            <CardDescription className="text-red-200/80">{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" onClick={() => void reload()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const condicao = textoCondicaoVigente({
    statusCadastro: data.statusCadastro,
    condicaoPagamento: data.condicaoPagamento,
    prazoPagamento: data.prazoPagamento,
    condicaoPagamentoLabel: data.condicaoPagamentoLabel,
    prazoPagamentoLabel: data.prazoPagamentoLabel,
  });
  const layoutFaturamento = isLayoutFaturamentoPortal({
    statusCadastro: data.statusCadastro,
    condicaoPagamento: data.condicaoPagamento,
  });
  const layoutPix = isLayoutPixPortal({
    statusCadastro: data.statusCadastro,
    condicaoPagamento: data.condicaoPagamento,
  });
  const recentTotalPages = Math.max(1, Math.ceil(data.recent.total / recentLimit));
  const showFinance = podeFinanceiro && !secOffline;

  return (
    <main className="mx-auto w-[90%] px-4 py-8">
      {secOffline ? (
        <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-950/35 px-4 py-3 text-sm text-amber-100">
          Serviço de segurança indisponível — exibindo informações essenciais.
        </div>
      ) : null}
      {secDegraded ? (
        <div className="mb-4 rounded-lg border border-orange-500/45 bg-orange-950/35 px-4 py-3 text-sm text-orange-100">
          Serviço de segurança lento — reduzindo chamadas automáticas de monitoramento.
        </div>
      ) : null}

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12">
          <SectionTitle title="Visão geral" description={condicao.descricao} className="mb-2" />
          <p className="mb-4 text-sm font-medium text-slate-300">{condicao.titulo}</p>
        </div>

        <div className="col-span-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Solicitações em aberto"
            value={data.solicitacoesAbertas}
            hint="Pendentes, em análise e em operação"
            icon={ClipboardList}
          />
          <KpiCard
            title="Unidades no pátio"
            value={data.unidadesNoPatio}
            hint="IDs abertos no pátio"
            icon={Container}
          />
          <KpiCard
            title="Agenda de hoje"
            value={data.agendamentosHoje}
            hint="Janelas marcadas para hoje"
            icon={CalendarClock}
          />
          {showFinance ? (
            <KpiCard
              title={layoutPix ? "A pagar (PIX)" : "A pagar"}
              value={formatBRL(data.finance.valorEmAberto)}
              hint={
                layoutPix
                  ? "Faturas FAT aguardando PIX"
                  : "Faturas FAT em aberto"
              }
              icon={WalletCards}
            />
          ) : null}
        </div>

        {showFinance ? (
          <div className="col-span-12">
            <Card>
              <CardHeader>
                <CardTitle>Financeiro</CardTitle>
                <CardDescription>
                  {layoutFaturamento
                    ? "Faturas FAT com demonstrativo, NFS-e e boleto."
                    : "Faturas FAT com demonstrativo e NFS-e. Pagamento à vista via PIX."}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {layoutPix ? "Faturas a pagar" : "Faturas em aberto"}
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
                    {data.finance.faturasEmAberto}
                  </p>
                </div>
                {layoutFaturamento ? (
                  <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Boletos em aberto
                    </p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
                      {data.finance.boletosPendentes}
                    </p>
                    {data.finance.boletosVencidos > 0 ? (
                      <p className="mt-1 text-xs text-rose-400">
                        {data.finance.boletosVencidos} vencido
                        {data.finance.boletosVencidos === 1 ? "" : "s"}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Conta corrente
                    </p>
                    <p
                      className={`mt-1 text-2xl font-semibold tabular-nums ${saldoClass(data.finance.saldoContaCorrente)}`}
                    >
                      {formatBRL(data.finance.saldoContaCorrente)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{saldoHint(data.finance.saldoContaCorrente)}</p>
                  </div>
                )}
                <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">NFS-e emitidas</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
                    {data.finance.nfseEmitidas}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {layoutPix ? "Faturas do mês" : "Faturado no mês"}
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
                    {formatBRL(data.finance.faturadoMes)}
                  </p>
                </div>
                <div className="col-span-full flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/portal/financeiro">Abrir financeiro</Link>
                  </Button>
                  {layoutFaturamento ? (
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/portal/financeiro/conta-corrente">Conta corrente</Link>
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {data.agendamentosHoje > 0 ? (
          <div className="col-span-12">
            <Card>
              <CardHeader>
                <CardTitle>Agenda de hoje</CardTitle>
                <CardDescription>Solicitações com janela marcada para hoje.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-white/5">
                  {data.solicitacoesHoje.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <ContainerNumber
                          value={collectSolicitacaoContainerISOs(s)[0] ?? "—"}
                          showLabel={false}
                          size="sm"
                        />
                        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                          {(() => {
                            const c = solicitacaoControleDisplay(s);
                            return c.secundario ? `${c.primario} · ${c.secundario}` : c.primario;
                          })()}
                          <SolicitacaoDirecaoBadge intent={s.tipoOperacao} />
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={s.status} />
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/portal/solicitacoes/${s.id}`}>Ver</Link>
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        ) : null}

        <div className="col-span-12 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/portal/solicitacoes">Solicitações</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/portal/patio">Consulta de estoque</Link>
          </Button>
          {podeFinanceiro ? (
            <Button variant="outline" size="sm" asChild>
              <Link href="/portal/financeiro">Financeiro</Link>
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            className={PORTAL_SCHEDULING_DISABLED_CLASS}
            disabled={bloqueadoFin}
            asChild={!bloqueadoFin}
            data-tour="nova-solicitacao"
          >
            {bloqueadoFin ? (
              <span>Nova solicitação</span>
            ) : (
              <Link href="/portal/solicitacoes">Nova solicitação</Link>
            )}
          </Button>
        </div>

        <div className="col-span-12">
          <Card>
            <CardHeader>
              <CardTitle>Solicitações recentes</CardTitle>
              <CardDescription>Últimas solicitações da sua empresa.</CardDescription>
              <div className="relative pt-2">
                <Input
                  className="pl-3"
                  placeholder="Filtrar por ISO, ID ou protocolo…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0 pt-2">
              <PortalTable
                columns={[
                  { key: "container", header: "Contêiner" },
                  { key: "status", header: "Status" },
                  { key: "tipo", header: "ID" },
                  { key: "createdAt", header: "Criação" },
                  { key: "act", header: "" },
                ]}
                rows={filteredRecent}
                getRowKey={(r) => r.id}
                renderCell={(r: SolicitacaoRow, key) => {
                  if (key === "container") {
                    const iso = collectSolicitacaoContainerISOs(r)[0] ?? "—";
                    return (
                      <button
                        type="button"
                        className="text-left"
                        onClick={() => {
                          const raw = collectSolicitacaoContainerISOs(r)[0];
                          if (raw) openContainerTimeline(raw);
                        }}
                      >
                        <ContainerNumber value={iso} showLabel={false} size="sm" />
                      </button>
                    );
                  }
                  if (key === "status") return <StatusBadge status={r.status} />;
                  if (key === "tipo") {
                    const c = solicitacaoControleDisplay(r);
                    return (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm text-white">{c.primario}</span>
                        <SolicitacaoDirecaoBadge intent={r.tipoOperacao} />
                      </div>
                    );
                  }
                  if (key === "createdAt") return formatDateTime(r.createdAt);
                  if (key === "act")
                    return (
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/portal/solicitacoes/${r.id}`}>Ver</Link>
                      </Button>
                    );
                  return null;
                }}
              />
              <div className="flex flex-wrap items-center justify-between gap-2 p-4">
                <p className="text-xs text-slate-500">
                  Pág. {recentPage} / {recentTotalPages} · {data.recent.total} registros
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={recentPage <= 1}
                    onClick={() => setRecentPage((p) => p - 1)}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={recentPage >= recentTotalPages}
                    onClick={() => setRecentPage((p) => p + 1)}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <PortalContainerTimelineSlideOver
        iso={timelineIso}
        open={timelineOpen}
        onClose={() => setTimelineOpen(false)}
      />
    </main>
  );
}
