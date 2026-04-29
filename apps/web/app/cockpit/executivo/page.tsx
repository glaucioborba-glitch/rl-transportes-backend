"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError, staffJson } from "@/lib/api/staff-client";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { toast } from "@/lib/toast";

function Spark({ values }: { values: number[] }) {
  if (!values.length) return <span className="text-slate-600">—</span>;
  const max = Math.max(...values, 1);
  return (
    <div className="flex h-10 items-end gap-px">
      {values.map((v, i) => (
        <div key={i} className="w-1 rounded-t bg-[var(--accent)]/70" style={{ height: `${(v / max) * 100}%` }} />
      ))}
    </div>
  );
}

export default function CockpitExecutivoPage() {
  const role = useStaffAuthStore((s) => s.user?.role ?? "");
  const isGestao = role === "ADMIN" || role === "GERENTE";

  const [dash, setDash] = useState<Record<string, unknown> | null>(null);
  const [fin, setFin] = useState<Record<string, unknown> | null>(null);
  const [perf, setPerf] = useState<Record<string, unknown> | null>(null);
  const [relFin, setRelFin] = useState<unknown>(null);

  const range = (() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 90);
    return {
      di: start.toISOString().slice(0, 10),
      df: end.toISOString().slice(0, 10),
    };
  })();

  const load = useCallback(async () => {
    try {
      const [d, p] = await Promise.all([
        staffJson<Record<string, unknown>>(`/dashboard`),
        staffJson<Record<string, unknown>>(`/dashboard-performance`),
      ]);
      setDash(d);
      setPerf(p);
      if (isGestao) {
        try {
          setFin(await staffJson(`/dashboard-financeiro?dataInicio=${range.di}&dataFim=${range.df}`));
        } catch {
          setFin(null);
        }
        try {
          setRelFin(
            await staffJson(`/relatorios/financeiro/faturamento?dataInicio=${range.di}&dataFim=${range.df}`),
          );
        } catch {
          setRelFin(null);
        }
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro executivo");
    }
  }, [isGestao, range.di, range.df]);

  useEffect(() => {
    void load();
  }, [load]);

  const estr = perf?.estrategicos as Record<string, unknown> | undefined;
  const series = perf?.series as Record<string, unknown> | undefined;
  const diaria = (series?.produtividadeDiaria30d as { dia: string; operacoes: number }[]) ?? [];
  const valores = diaria.map((x) => x.operacoes);

  const snap = dash?.snapshot as Record<string, unknown> | undefined;
  const prob = snap?.unidadesComProblemas as Record<string, unknown> | undefined;

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-8">
      <h1 className="text-2xl font-bold text-white">Cockpit executivo</h1>
      {!isGestao ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          Alguns blocos exigem perfil ADMIN/GERENTE (financeiro, relatórios).
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-white/10 bg-[#0a0d14]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-400">Dwell médio (proxy SLA)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">
              {String((dash?.sla as Record<string, unknown>)?.idadeMediaEstadiaHoras ?? "—")}
              <span className="text-sm font-normal text-slate-500"> h</span>
            </p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-[#0a0d14]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-400">Gate / hora</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">{String(estr?.throughputGate ?? "—")}</p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-[#0a0d14]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-400">Ocupação pátio %</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">{String(estr?.ocupacaoPatioPercent ?? "—")}</p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-[#0a0d14]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-400">Custo / operação (proxy)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">{String(estr?.custoMedioPorOperacao ?? "—")}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-white/10 bg-[#0a0d14]">
          <CardHeader>
            <CardTitle className="text-white">Tendência throughput (30d)</CardTitle>
            <CardDescription>Série vinda do backend</CardDescription>
          </CardHeader>
          <CardContent>
            <Spark values={valores.length ? valores : [0]} />
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-[#0a0d14]">
          <CardHeader>
            <CardTitle className="text-white">Alertas críticos (snapshot)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-300">
            <p>ISO duplicado: {String(prob?.isoDuplicadoEmSolicitacoesAtivas ?? 0)}</p>
            <p>Gates sem portaria: {String(prob?.gatesSemPortaria ?? 0)}</p>
            <p>Saídas sem gate/pátio: {String(prob?.saidasSemGateOuPatio ?? 0)}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/10 bg-[#0a0d14]">
        <CardHeader>
          <CardTitle className="text-white">Matriz de risco (qualitativa)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {[
            ["Operacional", "Alta" as const],
            ["Financeiro", isGestao ? "Média" : "N/D"],
            ["Fiscal", isGestao ? "Baixa" : "N/D"],
            ["Capacidade", Number(estr?.ocupacaoPatioPercent ?? 0) > 85 ? "Alta" : "Média"],
          ].map(([nome, nivel]) => (
            <div key={String(nome)} className="rounded-xl border border-white/10 bg-black/30 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">{nome}</p>
              <p className="text-lg font-semibold text-white">{nivel}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {isGestao ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-white/10 bg-[#0a0d14]">
            <CardHeader>
              <CardTitle className="text-white">Dashboard financeiro</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="max-h-72 overflow-auto text-[10px] text-slate-500">{JSON.stringify(fin, null, 2)}</pre>
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-[#0a0d14]">
            <CardHeader>
              <CardTitle className="text-white">Relatório faturamento</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="max-h-72 overflow-auto text-[10px] text-slate-500">{JSON.stringify(relFin, null, 2)}</pre>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </main>
  );
}
