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
import { usePortalDashboard } from "@/hooks/use-portal-dashboard";
import { deriveTrackingLabel, formatDateTime, operationTypeLabel } from "@/lib/portal-tracking";
import type { SolicitacaoRow } from "@/lib/api/portal-client";
import { CalendarClock, Container, Gauge, LayoutGrid, WalletCards } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

const TURNOS = [
  { id: "m", label: "Manhã · 07:00–13:00 (UTC)", startH: 7, endH: 13, cap: 40 },
  { id: "t", label: "Tarde · 13:00–20:00 (UTC)", startH: 13, endH: 20, cap: 40 },
];

function hourUtc(iso: string) {
  return new Date(iso).getUTCHours();
}

function countInTurn(rows: SolicitacaoRow[], startH: number, endH: number) {
  return rows.filter((s) => {
    const h = hourUtc(s.createdAt);
    return h >= startH && h < endH;
  }).length;
}

export function PortalDashboardClient() {
  const [recentPage, setRecentPage] = useState(1);
  const recentLimit = 8;
  const { data, loading, error, reload } = usePortalDashboard({ recentPage, recentLimit });
  const [q, setQ] = useState("");

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

  if (loading && !data) {
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

  const slaPct =
    data.slas.historicoProxy.find((h) => h.periodo === "30d")?.cumprimentoPctProxy ??
    data.slas.historicoProxy[0]?.cumprimentoPctProxy ??
    null;
  const kpis = data.kpis.valores;
  const recentTotalPages = Math.max(1, Math.ceil(data.recent.total / recentLimit));

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12">
          <SectionTitle
            title="Visão geral"
            description="KPIs / SLAs e listagens de solicitações em /cliente/portal; aprovação via PATCH /portal/solicitacoes/:id/aprovar; financeiro resumo via /cliente/portal/financeiro/*."
          />
        </div>

        <div className="col-span-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Unidades ativas"
            value={kpis.containers_ativos}
            hint="GET /cliente/portal/kpis"
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
            value={slaPct != null ? `${slaPct}%` : "—"}
            hint="GET /cliente/portal/slas"
            icon={Gauge}
          />
          <KpiCard
            title="Pendências financeiras"
            value={data.pendenciasFinanceiras}
            hint="Boletos com status ≠ pago (GET /cliente/portal/financeiro/boletos)"
            icon={WalletCards}
          />
        </div>

        <div className="col-span-12">
          <Card>
            <CardHeader>
              <CardTitle>Financeiro resumo</CardTitle>
              <CardDescription>
                Contadores alinhados ao CX e ao KPI de faturamento em aberto.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
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
                  NFS-e (amostra API)
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
                  {data.financeCounts.nfseEmitidasAmostra}
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
                <Link href="/portal/agendamentos">Agendamentos</Link>
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
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm text-white">{s.protocolo}</span>
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
              <Button className="w-full" variant="outline" asChild>
                <Link href="/portal/agendamentos">Abrir agendamentos</Link>
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
                  { key: "protocolo", header: "Protocolo" },
                  { key: "status", header: "Status" },
                  { key: "tipo", header: "Tipo" },
                  { key: "createdAt", header: "Criação" },
                  { key: "act", header: "" },
                ]}
                rows={data.recent.items}
                getRowKey={(r) => r.id}
                renderCell={(r, key) => {
                  if (key === "protocolo")
                    return <span className="font-mono text-sm text-white">{r.protocolo}</span>;
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
    </main>
  );
}
