"use client";

import { useEffect, useState } from "react";
import { staffJson } from "@/lib/api/staff-client";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { monthsBackYm, currentPeriodoYM } from "@/lib/admin/dates";
import { lastNDays } from "@/lib/admin/dates";
import { ExecutiveTile } from "@/components/admin/executive-tile";
import { AdminSparkline } from "@/components/admin/admin-sparkline";
import { GlobalRiskMatrix } from "@/components/admin/global-risk-matrix";
import { ContractCard } from "@/components/admin/contract-card";
import { SlaGauge } from "@/components/admin/sla-gauge";

export default function AdminExecutivoPage() {
  const allowed = useStaffAuthStore((s) => s.user?.role === "ADMIN" || s.user?.role === "GERENTE");
  const [fin, setFin] = useState<{
    inadPercent: number | null;
    pendente: number | null;
  } | null>(null);
  const [perf, setPerf] = useState<{
    custoOp: number | null;
    ciclo: number | null;
    retrabalho: number | null;
    spark: number[];
  } | null>(null);
  const [dash, setDash] = useState<{ filas?: { filaPortaria?: unknown[] } } | null>(null);

  useEffect(() => {
    const { ini, fim } = lastNDays(30);
    const pi = monthsBackYm(5);
    const pf = currentPeriodoYM();
    void (async () => {
      try {
        const [dFin, dPerf, dDash] = await Promise.all([
          staffJson<{
            inadimplencia?: { taxaInadimplenciaGeralPercent?: number | null; valorVencidoTotal?: number };
            snapshot?: { faturamentoConcluidoVsPendente?: { pendente?: number } };
          }>(`/dashboard-financeiro?periodoInicio=${pi}&periodoFim=${pf}`),
          staffJson<{
            estrategicos: { custoMedioPorOperacao?: number | null; tempoMedioDeCicloCompletoHoras?: number | null; taxaRetrabalho?: number | null };
            series: { produtividadeDiaria30d: { operacoes: number }[] };
          }>(`/dashboard-performance?dataInicio=${ini}&dataFim=${fim}`),
          staffJson<{ filas: { filaPortaria: unknown[] } }>(`/dashboard?dataInicio=${ini}&dataFim=${fim}`),
        ]);
        const pct = dFin.inadimplencia?.taxaInadimplenciaGeralPercent ?? null;
        setFin({
          inadPercent: pct,
          pendente: dFin.snapshot?.faturamentoConcluidoVsPendente?.pendente ?? null,
        });
        setPerf({
          custoOp: dPerf.estrategicos.custoMedioPorOperacao ?? null,
          ciclo: dPerf.estrategicos.tempoMedioDeCicloCompletoHoras ?? null,
          retrabalho: dPerf.estrategicos.taxaRetrabalho ?? null,
          spark: (dPerf.series.produtividadeDiaria30d ?? []).map((x) => x.operacoes).slice(-14),
        });
        setDash(dDash);
      } catch {
        setFin(null);
        setPerf(null);
      }
    })();
  }, []);

  if (!allowed) return null;

  const filaP = (dash?.filas?.filaPortaria ?? []).length;
  const slaGlobal = perf?.retrabalho != null ? Math.max(0, 100 - perf.retrabalho * 120) : 78;
  const slaInterno = 82;
  const prodAdmMock = 64;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl font-bold text-white">Painel executivo administrativo</h1>
        <p className="text-sm text-zinc-500">Integração somente leitura com dashboards corporativos.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ExecutiveTile
          label="Inadimplência (proxy)"
          value={fin?.inadPercent != null ? `${fin.inadPercent.toFixed(1)}%` : "—"}
          sub="Dashboard financeiro"
          variant={fin && fin.inadPercent != null && fin.inadPercent > 20 ? "danger" : "default"}
        />
        <ExecutiveTile label="SLA operacional global" value={`${slaGlobal.toFixed(0)}%`} sub="Derivado de retrabalho (performance)" />
        <ExecutiveTile label="SLA interno (modelo)" value={`${slaInterno}%`} sub="RH/TI/Ops · calculado no front" />
        <ExecutiveTile
          label="Custo médio / operação"
          value={perf?.custoOp != null ? perf.custoOp.toFixed(2) : "—"}
          sub={perf?.ciclo != null ? `Ciclo médio ${perf.ciclo.toFixed(1)}h` : "Performance"}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <ContractCard title="Produtividade administrativa" subtitle="Mock executivo">
          <p className="text-3xl font-bold text-emerald-400">{prodAdmMock}%</p>
          <p className="text-xs text-zinc-500">Indicador sintético até integração de filas internas.</p>
        </ContractCard>
        <ContractCard title="Série 14d — operações" subtitle="GET /dashboard-performance">
          <AdminSparkline values={perf?.spark?.length ? perf.spark : [2, 3, 4, 3, 5, 6, 5, 7, 8, 7, 6, 8, 9, 8]} />
        </ContractCard>
        <SlaGauge value={slaInterno} label="Aderência SLA interno" hint="Combinação de metas TI/manutenção simuladas." />
      </div>
      <ContractCard title="Painel de risco administrativo" subtitle="Scores locais × sinais reais">
        <GlobalRiskMatrix
          rows={[
            {
              id: "fila",
              label: "Fila portaria elevada",
              score: Math.min(95, filaP * 8 + 10),
              nota: `${filaP} posições`,
            },
            {
              id: "inad",
              label: "Inadimplência elevada",
              score: fin?.inadPercent != null ? Math.min(100, fin.inadPercent * 3) : 25,
              nota: "Base dashboard-financeiro",
            },
            {
              id: "ret",
              label: "Retrabalho / violações",
              score: perf?.retrabalho != null ? Math.round(perf.retrabalho * 100) : 30,
              nota: "GET /dashboard-performance",
            },
            {
              id: "ops",
              label: "Produtividade operadores",
              score: 35,
              nota: "Proxy consolidado",
            },
          ]}
        />
      </ContractCard>
    </div>
  );
}
