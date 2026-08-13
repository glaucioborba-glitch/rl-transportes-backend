"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiCard, SectionTitle } from "@/components/portal/portal-primitives";
import { PortalTable } from "@/components/portal/portal-table";
import { StatusBadge } from "@/components/portal/status-badge";
import { Progress } from "@/components/ui/progress";
import { usePortalDashboard } from "@/hooks/use-portal-dashboard";
import { usePortalHealth } from "@/hooks/use-portal-health";
import { deriveTrackingLabel, formatDateTime, operationTypeLabel } from "@/lib/portal-tracking";
import { collectSolicitacaoContainerISOs } from "@/lib/container-display";
import { ContainerNumber } from "@/components/ui/container-number";
import { ProtocolRefLabel } from "@/components/shared/operation-identity";
import { PortalContainerTimelineSlideOver } from "@/components/portal/container-timeline-slideover";
import type { SolicitacaoRow } from "@/lib/api/portal-client";
import { CalendarClock, Container, Gauge, LayoutGrid, TrendingDown, TrendingUp, WalletCards } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { PORTAL_BLOQUEIO_FINANCEIRO_TOAST, PORTAL_SCHEDULING_DISABLED_CLASS } from "@/lib/portal-financeiro-block";
import { labelCondicaoPagamento } from "@/lib/condicao-pagamento-portal";
import { usePortalClienteAuthStore } from "@/stores/portalClienteAuthStore";
import { toast } from "@/lib/toast";

const TURNOS = [
  { id: "m", label: "Manhã · 07:00–13:00 (UTC)", startH: 7, endH: 13, cap: 40 },
  { id: "t", label: "Tarde · 13:00–20:00 (UTC)", startH: 13, endH: 20, cap: 40 },
];

function hourUtc(iso: string) {
  return new Date(iso).getUTCHours();
}

function TrendDelta({ value, label }: { value: number; label: string }) {
  const up = value >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium tabular-nums ${
        up ? "text-emerald-400" : "text-rose-400"
      }`}
    >
      {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
      {value > 0 ? "+" : ""}
      {value.toFixed(1)}% <span className="text-slate-500">{label}</span>
    </span>
  );
}

function pctPart(n: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((n / total) * 100));
}

function countInTurn(rows: SolicitacaoRow[], startH: number, endH: number) {
  return rows.filter((s) => {
    const h = hourUtc(s.createdAt);
    return h >= startH && h < endH;
  }).length;
}

export function PortalDashboardClient() {
  const searchParams = useSearchParams();
  const bloqueadoFin = usePortalClienteAuthStore((s) => s.isBloqueadoFinanceiramente);
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

  const agendamentosHoje = data?.solicitacoesHoje.length ?? 0;

  const filteredTracking = useMemo(() => {
    const rows = data?.tracking ?? [];
    const qq = q.trim().toLowerCase();
    if (!qq) return rows;
    return rows.filter(
      (s) =>
        s.protocolo.toLowerCase().includes(qq) ||
        (s.unidades ?? []).some((u) => u.numeroIso.toLowerCase().includes(qq)),
    );
  }, [data?.tracking, q]);

  if (awaitingPessoa || (loading && !data)) {
    return (
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
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
      <main className="mx-auto max-w-7xl px-4 py-8">
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

  const slaMedioPct = data.slaDesempenho;
  const kpis = data.kpis.valores;
  const recentTotalPages = Math.max(1, Math.ceil(data.recent.total / recentLimit));

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      {secOffline ? (
        <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-950/35 px-4 py-3 text-sm text-amber-100">
          Serviço de segurança indisponível — exibindo informações essenciais (cliente, agendamentos e
          solicitações).
        </div>
      ) : null}
      {secDegraded ? (
        <div className="mb-4 rounded-lg border border-orange-500/45 bg-orange-950/35 px-4 py-3 text-sm text-orange-100">
          Serviço de segurança lento — reduzindo chamadas automáticas de monitoramento.
        </div>
      ) : null}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12">
          <SectionTitle
            title="Visão geral"
            description="KPIs / SLAs e listagens de solicitações em /cliente/portal; aprovação via PATCH /cliente/portal/solicitacoes/:id/aprovar; financeiro em /cliente/portal/financeiro/*."
          />
        </div>

        <div className="col-span-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Unidades ativas"
            value={kpis.containers_ativos}
            hint="Solicitações pendentes/aprovadas aguardando saída (ciclo aberto)"
            icon={Container}
          />
          <KpiCard
            title="Agendamentos do dia"
            value={agendamentosHoje}
            hint="Proxy: solicitações criadas hoje (UTC)"
            icon={CalendarClock}
          />
          <KpiCard
            title="SLA médio"
            value={slaMedioPct != null ? `${slaMedioPct}%` : "—"}
            hint="Cumprimento real (municipal / terminal) — amostra concluída"
            icon={Gauge}
          />
          {!secOffline ? (
            <KpiCard
              title="Pendências financeiras"
              value={data.pendenciasFinanceiras}
              hint="Boletos com status ≠ pago (GET /cliente/portal/financeiro/boletos)"
              icon={WalletCards}
            />
          ) : null}
        </div>

        <div className="col-span-12 grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Tendências (mês vs anterior)</CardTitle>
              <CardDescription>Variação de solicitações criadas e faturamento (mês civil UTC).</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs text-slate-500">Solicitações (criadas no mês)</p>
                <TrendDelta
                  value={data.tendencias.solicitacoesMesVsAnteriorPct}
                  label="vs mês anterior"
                />
              </div>
              <div>
                <p className="text-xs text-slate-500">Faturamento (R$ no mês)</p>
                <TrendDelta
                  value={data.tendencias.faturadoMesVsAnteriorPct}
                  label="vs mês anterior"
                />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Unidades por tipo</CardTitle>
              <CardDescription>
                Total {data.unidades.total} contêineres vinculados às suas solicitações.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(
                [
                  ["import", "Import"],
                  ["export", "Export"],
                  ["gateIn", "Gate-In"],
                  ["gateOut", "Gate-Out"],
                ] as const
              ).map(([k, label]) => {
                const n = data.unidades[k];
                const p = pctPart(n, data.unidades.total);
                return (
                  <div key={k} className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>{label}</span>
                      <span className="tabular-nums text-slate-300">
                        {n} <span className="text-slate-500">({p}%)</span>
                      </span>
                    </div>
                    <Progress value={p} />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {!secOffline ? (
        <div className="col-span-12">
          <Card>
            <CardHeader>
              <CardTitle>Financeiro resumo</CardTitle>
              <CardDescription>
                Contadores alinhados ao CX e ao KPI de faturamento em aberto.
              </CardDescription>
              {data.condicaoPagamento ? (
                <p className="text-xs text-muted-foreground">
                  Condição contratual: {labelCondicaoPagamento(data.condicaoPagamento)}
                </p>
              ) : null}
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Faturas em aberto
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
                  {data.financeCounts.faturasEmAberto}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Boletos abertos / vencidos
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
                  {data.financeCounts.boletosAbertosOuVencidos}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  NFS-e (emitidas)
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
                  {data.financeCounts.nfseEmitidasAmostra}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Faturamento no mês (R$)
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
                  {data.financeCounts.faturadoMes.toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div className="col-span-full flex flex-wrap gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href="/portal/financeiro">Abrir financeiro</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/portal/documentos">Documentos</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        ) : null}

        <div className="col-span-12 lg:col-span-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LayoutGrid className="h-5 w-5 text-[var(--accent)]" strokeWidth={1.5} />
                Atalhos
              </CardTitle>
              <CardDescription>Navegação rápida do portal corporativo.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/portal/solicitacoes">Solicitações</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/portal/financeiro">Financeiro</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-7">
          <Card>
            <CardHeader>
              <CardTitle>SLA e operação</CardTitle>
              <CardDescription>Contratados (proxy por tenant) e histórico.</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible defaultValue="slas">
                <AccordionItem value="slas">
                  <AccordionTrigger>Detalhes de SLA</AccordionTrigger>
                  <AccordionContent>
                    <pre className="max-h-48 overflow-auto rounded-lg bg-black/40 p-3 text-xs text-slate-300">
                      {JSON.stringify(
                        {
                          contratados: data.slas.contratadosProxy,
                          historico: data.slas.historicoProxy,
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </div>

        <div className="col-span-12 xl:col-span-8">
          <Card>
            <CardHeader>
              <CardTitle>Tracking rápido</CardTitle>
              <CardDescription>Últimas solicitações — filtre por ISO ou protocolo.</CardDescription>
              <div className="relative pt-2">
                <Input
                  className="pl-3"
                  placeholder="Filtrar por ISO ou protocolo…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-white/5 rounded-xl border border-white/10">
                {filteredTracking.map((s) => {
                  const label = deriveTrackingLabel(s);
                  return (
                    <li
                      key={s.id}
                      className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          className="text-left"
                          onClick={() => {
                            const iso = collectSolicitacaoContainerISOs(s)[0];
                            if (iso) openContainerTimeline(iso);
                          }}
                        >
                          <ContainerNumber
                            value={collectSolicitacaoContainerISOs(s)[0] ?? "—"}
                            showLabel={false}
                            size="md"
                          />
                        </button>
                        <ProtocolRefLabel protocolo={s.protocolo} className="mt-1" />
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <StatusBadge status={s.status} />
                          <span className="text-xs text-slate-500">{label}</span>
                        </div>
                        <p className="text-xs text-slate-500">
                          {formatDateTime(s.createdAt)} · {operationTypeLabel(s)}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/portal/solicitacoes/${s.id}`}>Ver detalhes</Link>
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="col-span-12 xl:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle>Agendamentos · modelo A1</CardTitle>
              <CardDescription>
                Capacidade 40 por turno — ocupação por horário UTC da criação da solicitação.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {TURNOS.map((t) => {
                const occupied = countInTurn(data.solicitacoesHoje, t.startH, t.endH);
                const pct = Math.min(100, Math.round((occupied / t.cap) * 100));
                return (
                  <div key={t.id} className="space-y-1">
                    <div className="flex justify-between text-sm text-slate-300">
                      <span>{t.label}</span>
                      <span className="tabular-nums text-slate-500">
                        {occupied}/{t.cap}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full bg-[var(--accent)] transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              <Button
                className={`w-full ${PORTAL_SCHEDULING_DISABLED_CLASS}`}
                variant="outline"
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
            </CardContent>
          </Card>
        </div>

        <div className="col-span-12">
          <Card>
            <CardHeader>
              <CardTitle>Solicitações recentes</CardTitle>
              <CardDescription>GET /cliente/portal/solicitacoes — paginação server-side.</CardDescription>
            </CardHeader>
            <CardContent className="p-0 pt-2">
              <PortalTable
                columns={[
                  { key: "container", header: "Contêiner" },
                  { key: "status", header: "Status" },
                  { key: "tipo", header: "Tipo" },
                  { key: "createdAt", header: "Criação" },
                  { key: "act", header: "" },
                ]}
                rows={data.recent.items}
                getRowKey={(r) => r.id}
                renderCell={(r, key) => {
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
                  if (key === "tipo") return operationTypeLabel(r);
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
