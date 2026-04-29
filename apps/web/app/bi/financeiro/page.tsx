"use client";

import { useCallback, useEffect, useState } from "react";
import { BiWorkspace } from "@/components/bi/bi-workspace";
import { BiSection } from "@/components/bi/bi-section";
import { MarginRadarChart } from "@/components/bi/margin-radar-chart";
import { AbcHybridMatrix, type AbcBubble } from "@/components/bi/abc-hybrid-matrix";
import { ElasticityPanel } from "@/components/bi/elasticity-panel";
import { FinancialForecastChart } from "@/components/bi/financial-forecast-chart";
import { StrategicRiskBoard } from "@/components/bi/strategic-risk-board";
import { ApiError, staffJson } from "@/lib/api/staff-client";
import { toast } from "@/lib/toast";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { Button } from "@/components/ui/button";

type SimuladorComercial = {
  impactoReceitaLinear: number;
  volumeEstimado: number;
  receitaNovaEstimada: number;
  elasticidadeAplicada: number;
};

const TOC = [
  { id: "margem", label: "Margem" },
  { id: "abc", label: "ABC híbrido" },
  { id: "elasticidade", label: "Elasticidade" },
  { id: "forecast", label: "Forecast" },
  { id: "risco", label: "Riscos" },
] as const;

export default function BiFinanceiroPage() {
  const allowed = useStaffAuthStore((s) => s.user?.role === "ADMIN" || s.user?.role === "GERENTE");
  const [fin, setFin] = useState<Record<string, unknown> | null>(null);
  const [seriesT, setSeriesT] = useState<Record<string, unknown> | null>(null);
  const [ind, setInd] = useState<Record<string, unknown> | null>(null);
  const [abc, setAbc] = useState<Record<string, unknown> | null>(null);
  const [fatRel, setFatRel] = useState<Record<string, unknown> | null>(null);
  const [sim, setSim] = useState<SimuladorComercial | null>(null);

  const load = useCallback(async () => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 90);
    const pi = start.toISOString().slice(0, 10);
    const pf = end.toISOString().slice(0, 10);
    try {
      const [f, st, i, a, fr] = await Promise.all([
        staffJson<Record<string, unknown>>(`/dashboard-financeiro?periodoInicio=${pi}&periodoFim=${pf}`),
        staffJson<Record<string, unknown>>(`/comercial/series-temporais?meses=12`),
        staffJson<Record<string, unknown>>(`/comercial/indicadores?dataInicio=${pi}&dataFim=${pf}`),
        staffJson<Record<string, unknown>>(`/comercial/curva-abc?dataInicio=${pi}&dataFim=${pf}&modo=lucro`).catch(() => null),
        staffJson<Record<string, unknown>>(`/relatorios/financeiro/faturamento?dataInicio=${pi}&dataFim=${pf}`).catch(() => null),
      ]);
      setFin(f);
      setSeriesT(st);
      setInd(i);
      setAbc(a);
      setFatRel(fr);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha BI financeiro");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const snap = fin?.snapshot as
    | { mediaTicketPorSolicitacao?: number | null; faturamentoTotalPeriodo?: number }
    | undefined;
  const rent = fin?.rentabilidade as {
    proxyMargemOperacional?: number | null;
    faturamentoPorContainer?: number | null;
  } | undefined;
  const inad = fin?.inadimplencia as {
    forecastInadimplenciaPercent?: number | null;
    forecastFaturamentoProximoMes?: number | null;
    taxaInadimplenciaGeralPercent?: number | null;
  } | undefined;
  const curvaFin = fin?.clientes as { curvaAbc?: { classe: "A" | "B" | "C" }[] } | undefined;
  const indData = ind as {
    faturamentoTotal?: number;
    lucroEstimado?: number;
    margemMediaPct?: number | null;
    elasticidadeDemandaMedia?: number | null;
  } | undefined;

  const serieFin =
    (fin?.series as { mes: string; faturado: number; vencido: number; pendente?: number }[]) ?? [];
  const meses = serieFin.map((s) => s.mes);
  const receita = serieFin.map((s) => s.faturado);
  let acc = 0;
  const inadAcum = serieFin.map((s) => {
    const t = s.faturado + (s.pendente ?? 0) + 1e-6;
    acc += (s.vencido / t) * 100;
    return acc;
  });

  const lucroPct =
    indData && indData.faturamentoTotal && indData.faturamentoTotal > 0
      ? (indData.lucroEstimado! / indData.faturamentoTotal) * 100
      : 0;

  const marginRadar = {
    margemPct: Math.min(100, Math.max(0, indData?.margemMediaPct ?? lucroPct)),
    ticket: Math.min(100, ((snap?.mediaTicketPorSolicitacao ?? 0) / 40_000) * 100),
    lucroNorm: Math.min(100, Math.max(0, lucroPct)),
    container: Math.min(100, ((rent?.faturamentoPorContainer ?? 0) / 60_000) * 100),
    rentab: Math.min(100, Math.max(0, (lucroPct + (indData?.margemMediaPct ?? lucroPct)) / 2)),
  };

  const abcItens = (abc?.itens as { clienteId: string; clienteNome: string; faturamento: number; lucro: number; margemPct: number | null; classe: "A" | "B" | "C" }[]) ?? [];
  const maxF = Math.max(...abcItens.map((i) => i.faturamento), 1);
  const maxLuc = Math.max(...abcItens.map((i) => Math.abs(i.lucro)), 1);
  const bubbles: AbcBubble[] = abcItens.slice(0, 28).map((i) => ({
    id: i.clienteId,
    label: i.clienteNome,
    x: Math.max(0, i.margemPct ?? (i.faturamento > 0 ? (i.lucro / i.faturamento) * 100 : 0)),
    y: (i.faturamento / maxF) * 100,
    size: (Math.abs(i.lucro) / maxLuc) * 100,
    classe: i.classe,
  }));

  const abcList = curvaFin?.curvaAbc ?? [];
  const pctC = abcList.length ? (abcList.filter((x) => x.classe === "C").length / abcList.length) * 100 : 0;
  const top5share = (() => {
    const r = fin?.receita as { faturamentoPorClienteTop10?: { participacaoPercent: number }[] } | undefined;
    const top = r?.faturamentoPorClienteTop10 ?? [];
    return top.slice(0, 5).reduce((s, x) => s + (x.participacaoPercent ?? 0), 0);
  })();

  const riskTiles = [
    {
      id: "m",
      label: "% clientes classe C (proxy margem comprimida)",
      value: `${pctC.toFixed(1)}%`,
      tone: pctC > 35 ? ("crit" as const) : pctC > 20 ? ("warn" as const) : ("ok" as const),
      hint: "Curva ABC faturamento (dashboard financeiro).",
    },
    {
      id: "c",
      label: "% receita · top 5 clientes",
      value: `${top5share.toFixed(1)}%`,
      tone: top5share > 55 ? ("crit" as const) : top5share > 40 ? ("warn" as const) : ("ok" as const),
    },
    {
      id: "v",
      label: "Volume com baixa margem (classe C · receita)",
      value: `${pctC.toFixed(1)}%`,
      tone: pctC > 30 ? ("warn" as const) : ("ok" as const),
      hint: "Aproximação: peso ABC em C no período.",
    },
    {
      id: "i",
      label: "Inadimplência projetada",
      value: inad?.forecastInadimplenciaPercent != null ? `${inad.forecastInadimplenciaPercent.toFixed(2)}%` : "—",
      tone:
        (inad?.forecastInadimplenciaPercent ?? 0) > 15
          ? ("crit" as const)
          : (inad?.forecastInadimplenciaPercent ?? 0) > 8
            ? ("warn" as const)
            : ("ok" as const),
    },
    {
      id: "f",
      label: "Próx. mês · faturamento (API)",
      value:
        inad?.forecastFaturamentoProximoMes != null
          ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(
              inad.forecastFaturamentoProximoMes,
            )
          : "—",
      tone: "ok" as const,
    },
  ];

  const stSerie = (seriesT?.serie as { mes: string; faturamento: number }[]) ?? [];
  const serieResumo = `Série temporal comercial: ${stSerie.length} competências ( /comercial/series-temporais ).`;

  async function onSimulate(pa: number, pn: number, custo: number, vol: number, elast?: number) {
    const q = new URLSearchParams({
      precoAtual: String(pa),
      precoNovo: String(pn),
      custo: String(custo),
      volumeAtual: String(vol),
    });
    if (elast != null) q.set("elasticidade", String(elast));
    try {
      const r = await staffJson<SimuladorComercial>(`/comercial/simulador?${q}`);
      setSim(r);
      toast.success("Simulação atualizada");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha no simulador");
    }
  }

  if (!allowed) {
    return (
      <BiWorkspace>
        <p className="text-center text-amber-400">Acesso restrito.</p>
      </BiWorkspace>
    );
  }

  return (
    <BiWorkspace>
      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="lg:w-44 lg:shrink-0">
          <div className="sticky top-24 rounded-xl border border-white/10 bg-[#0a1018] p-3 text-[11px]">
            <p className="mb-2 font-bold uppercase tracking-wider text-emerald-500/80">Índice</p>
            <ul className="space-y-1">
              {TOC.map((t) => (
                <li key={t.id}>
                  <a href={`#${t.id}`} className="block rounded px-2 py-1 text-zinc-400 hover:bg-white/5 hover:text-emerald-300">
                    {t.label}
                  </a>
                </li>
              ))}
            </ul>
            <Button type="button" variant="ghost" size="sm" className="mt-3 w-full text-[10px] text-zinc-500" onClick={() => void load()}>
              Atualizar
            </Button>
          </div>
        </aside>
        <div className="min-w-0 flex-1 space-y-5">
          <p className="text-xs text-zinc-500">
            Rotas: <code className="text-zinc-400">/dashboard-financeiro</code>, <code className="text-zinc-400">/comercial/*</code>,{" "}
            <code className="text-zinc-400">/relatorios/financeiro/faturamento</code>. KPIs normalizados para o radar (0–100).
          </p>

          <BiSection id="margem" title="Margem operacional" subtitle="Rentabilidade · ticket · proxy / container (dashboard financeiro + indicadores)">
            <div className="grid gap-6 lg:grid-cols-2">
              <MarginRadarChart values={marginRadar} />
              <div className="space-y-3 text-sm text-zinc-400">
                <p>
                  <span className="text-zinc-500">Margem média (indicadores):</span>{" "}
                  <span className="font-mono text-emerald-300">{indData?.margemMediaPct?.toFixed(2) ?? "—"}%</span>
                </p>
                <p>
                  <span className="text-zinc-500">Ticket médio:</span>{" "}
                  <span className="font-mono text-white">
                    {snap?.mediaTicketPorSolicitacao != null
                      ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(snap.mediaTicketPorSolicitacao)
                      : "—"}
                  </span>
                </p>
                <p>
                  <span className="text-zinc-500">Faturamento / container:</span>{" "}
                  <span className="font-mono text-white">
                    {rent?.faturamentoPorContainer != null
                      ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(rent.faturamentoPorContainer)
                      : "—"}
                  </span>
                </p>
                {fatRel ? (
                  <p className="text-[11px] text-zinc-600">Relatório faturamento carregado (metadados/resumo via API).</p>
                ) : null}
              </div>
            </div>
          </BiSection>

          <BiSection id="abc" title="Curva ABC híbrida" subtitle="Lucro × intensidade (faturamento) · cor = classe ( /comercial/curva-abc )">
            {bubbles.length ? (
              <AbcHybridMatrix bubbles={bubbles} />
            ) : (
              <p className="text-sm text-zinc-500">Sem dados de curva ABC no período.</p>
            )}
            <p className="mt-2 text-[11px] text-zinc-600">Recomendações correlatas em /comercial/recomendacoes — ver painel corporativo para cards executivos.</p>
          </BiSection>

          <BiSection id="elasticidade" title="Elasticidade da demanda" subtitle="Série 12m + simulador GET /comercial/simulador">
            <ElasticityPanel
              elasticidadeMedia={indData?.elasticidadeDemandaMedia ?? null}
              serieResumo={serieResumo}
              onSimulate={onSimulate}
            />
            {sim ? (
              <div className="mt-4 grid gap-2 rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-4 text-sm">
                <p className="font-semibold text-emerald-200">Resultado do simulador</p>
                <p className="text-zinc-400">
                  Δ receita linear:{" "}
                  <span className="font-mono text-white">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(sim.impactoReceitaLinear)}
                  </span>
                </p>
                <p className="text-zinc-400">
                  Volume estimado: <span className="font-mono text-white">{sim.volumeEstimado?.toFixed?.(0) ?? sim.volumeEstimado}</span> · receita nova:{" "}
                  <span className="font-mono text-white">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(sim.receitaNovaEstimada)}
                  </span>
                </p>
                <p className="text-[11px] text-zinc-600">Elasticidade aplicada (API): {sim.elasticidadeAplicada?.toFixed?.(4) ?? sim.elasticidadeAplicada}</p>
              </div>
            ) : null}
          </BiSection>

          <BiSection id="forecast" title="Forecast financeiro" subtitle="Série mensal: receita (linha) vs inadimplência acumulada proxy (área)">
            {meses.length ? (
              <FinancialForecastChart meses={meses} receita={receita} inadimplenciaAcum={inadAcum} />
            ) : (
              <p className="text-sm text-zinc-500">Sem série no dashboard financeiro.</p>
            )}
            <p className="mt-2 text-[11px] text-zinc-500">
              Projeções 7/30/90: use <span className="text-emerald-400">forecastFaturamentoProximoMes</span> e tendência visual na série; extensões além da API são
              front-only opcional.
            </p>
          </BiSection>

          <BiSection id="risco" title="Indicadores de risco financeiro" subtitle="Concentração, ABC e inadimplência projetada">
            <StrategicRiskBoard tiles={riskTiles} />
          </BiSection>
        </div>
      </div>
    </BiWorkspace>
  );
}
