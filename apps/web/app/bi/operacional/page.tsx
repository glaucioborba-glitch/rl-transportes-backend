"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BiWorkspace } from "@/components/bi/bi-workspace";
import { BiSection } from "@/components/bi/bi-section";
import { ForecastLineChart, type ForecastSeries } from "@/components/bi/forecast-line-chart";
import { SaturacaoProjectionChart } from "@/components/bi/saturacao-projection-chart";
import { GargaloRiskMatrix } from "@/components/bi/gargalo-risk-matrix";
import { ThroughputPanel } from "@/components/bi/throughput-panel";
import { ThroughputProfileChart } from "@/components/bi/throughput-profile-chart";
import { HeatmapOperationalGrid } from "@/components/bi/heatmap-operational-grid";
import { WorkloadDistribution } from "@/components/bi/workload-distribution";
import { ApiError, staffJson, staffTryJson } from "@/lib/api/staff-client";
import { linearRegression, movingAverage, stddev, extrapolateLinear } from "@/lib/bi/forecast-math";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { Button } from "@/components/ui/button";

const TOC = [
  { id: "forecast", label: "Demanda" },
  { id: "patio", label: "Pátio" },
  { id: "throughput", label: "Throughput" },
  { id: "gargalos", label: "IA" },
  { id: "workload", label: "Carga" },
  { id: "heatmap", label: "Heatmap" },
] as const;

type DiaOp = { dia: string; operacoes: number };

function buildForecastSeries(dias: DiaOp[], horizon: 14 | 30 | 60): { labels: string[]; series: ForecastSeries[] } {
  const sorted = [...dias].sort((a, b) => a.dia.localeCompare(b.dia));
  const y = sorted.map((d) => d.operacoes);
  if (!y.length) {
    return { labels: [], series: [] };
  }
  const nFit = Math.min(30, y.length);
  const fitWindow = y.slice(-nFit);
  const L = Math.min(horizon, y.length, 30);
  const hist = y.slice(-L);
  const histLabels = sorted.slice(-L).map((d) => d.dia.slice(5));
  const { a, b } = linearRegression(fitWindow);
  const sigma = stddev(fitWindow) || 1;
  const futTrend = extrapolateLinear(a, b, nFit, horizon);
  const futOpt = futTrend.map((v) => v + sigma * 0.35);
  const futPess = futTrend.map((v) => Math.max(0, v - sigma * 0.35));
  const wMa = Math.min(5, Math.max(2, Math.floor(nFit / 4)));
  const maHist = movingAverage(fitWindow, wMa);
  const lastMa = maHist[maHist.length - 1] ?? hist[hist.length - 1] ?? 0;
  const maTail = maHist.slice(Math.max(0, maHist.length - L));
  const maPad =
    maTail.length < L
      ? [...Array(L - maTail.length).fill(maHist[0] ?? lastMa), ...maTail]
      : maTail.slice(-L);
  const trendOnHist = Array.from({ length: L }, (_, j) => Math.max(0, a + b * (nFit - L + j)));
  const labels = [...histLabels, ...Array.from({ length: horizon }, (_, i) => `+${i + 1}d`)];
  const series: ForecastSeries[] = [
    {
      id: "obs",
      label: "Histórico · ops/dia",
      color: "#94a3b8",
      values: [...hist, ...Array(horizon).fill(null)],
    },
    {
      id: "trend",
      label: "Tendência linear",
      color: "#22d3ee",
      values: [...trendOnHist, ...futTrend],
    },
    {
      id: "opt",
      label: "Cenário otimista",
      color: "#34d399",
      dashed: true,
      values: [...Array(L).fill(null), ...futOpt],
    },
    {
      id: "pess",
      label: "Cenário pessimista",
      color: "#f87171",
      dashed: true,
      values: [...Array(L).fill(null), ...futPess],
    },
    {
      id: "ma",
      label: "Média móvel (estendida)",
      color: "#eab308",
      dashed: true,
      values: [...(maPad as number[]), ...Array(horizon).fill(lastMa)],
    },
  ];
  return { labels, series };
}

function heat24x7(heat: { hora: number; total: number }[]): number[][] {
  const byHour = new Array(24).fill(0) as number[];
  for (const h of heat) {
    if (h.hora >= 0 && h.hora < 24) byHour[h.hora] += h.total;
  }
  const wdWeights = [1.05, 1.12, 1.08, 1.05, 1.15, 0.85, 0.7];
  const sumW = wdWeights.reduce((x, y) => x + y, 0);
  return Array.from({ length: 24 }, (_, hi) => wdWeights.map((w) => (byHour[hi]! * w) / sumW));
}

function pctSorted(arr: number[], p: number) {
  const s = [...arr].sort((x, y) => x - y);
  if (!s.length) return 0;
  const idx = (p / 100) * (s.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return s[lo]!;
  return s[lo]! + (s[hi]! - s[lo]!) * (idx - lo);
}

export default function BiOperacionalPage() {
  const allowed = useStaffAuthStore((s) => s.user?.role === "ADMIN" || s.user?.role === "GERENTE");
  const [horizon, setHorizon] = useState<14 | 30 | 60>(14);
  const [perf, setPerf] = useState<Record<string, unknown> | null>(null);
  const [dash, setDash] = useState<Record<string, unknown> | null>(null);
  const [cap, setCap] = useState<Record<string, unknown> | null>(null);
  const [proj, setProj] = useState<Record<string, unknown> | null>(null);
  const [gar, setGar] = useState<{ horizontes?: { horas: number; probabilidadePortaria: number; probabilidadeGate: number; probabilidadePatio: number; probabilidadeSaida: number }[] } | null>(null);
  const [relSol, setRelSol] = useState<{ total?: number } | null>(null);
  const [previsoesNote, setPrevisoesNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, d, c, alternativePrev] = await Promise.all([
        staffJson<Record<string, unknown>>(`/dashboard-performance`),
        staffJson<Record<string, unknown>>(`/dashboard`),
        staffJson<Record<string, unknown>>(`/simulador/capacidade`),
        staffTryJson<unknown>(`/ia-operacional/previsoes`),
      ]);
      setPerf(p);
      setDash(d);
      setCap(c);
      setPrevisoesNote(alternativePrev ? "Endpoint auxiliar disponível." : null);
      if (allowed) {
        try {
          setProj(await staffJson(`/simulador/projecao-saturacao`));
        } catch {
          setProj(null);
        }
        try {
          setGar(await staffJson(`/ia/gargalos`));
        } catch {
          setGar(null);
        }
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 90);
        try {
          setRelSol(await staffJson(`/relatorios/operacional/solicitacoes?dataInicio=${start.toISOString().slice(0, 10)}&dataFim=${end.toISOString().slice(0, 10)}`));
        } catch {
          setRelSol(null);
        }
      } else {
        setProj(null);
        setGar(null);
        setRelSol(null);
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha ao carregar BI operacional");
    }
  }, [allowed]);

  useEffect(() => {
    void load();
  }, [load]);

  const seriesDia = useMemo(() => (perf?.series as { produtividadeDiaria30d?: DiaOp[] })?.produtividadeDiaria30d ?? [], [perf]);
  const forecast = useMemo(() => buildForecastSeries(seriesDia, horizon), [seriesDia, horizon]);

  const estr = perf?.estrategicos as {
    throughputPortaria?: number | null;
    throughputGate?: number | null;
    throughputPatio?: number | null;
    tempoMedioDeCicloCompletoHoras?: number | null;
  } | undefined;

  const saidaProxy = estr ? ((estr.throughputGate ?? 0) + (estr.throughputPatio ?? 0)) / 2 : null;

  const prodHum = perf?.produtividadeHumana as
    | {
        mapaCalorPorHora?: { hora: number; total: number }[];
        produtividadePorOperador?: { usuarioId: string; email?: string | null; operacoes24h: number }[];
        produtividadePorTurno?: { manha: number; tarde: number; noite: number };
      }
    | undefined;

  const mapaCalor = useMemo(
    () =>
      ((perf?.produtividadeHumana as { mapaCalorPorHora?: { hora: number; total: number }[] } | undefined)?.mapaCalorPorHora ??
        []) as { hora: number; total: number }[],
    [perf],
  );
  const byHourVec = useMemo(() => {
    const v = new Array(24).fill(0);
    for (const h of mapaCalor) {
      if (h.hora >= 0 && h.hora < 24) v[h.hora] += h.total;
    }
    return v;
  }, [mapaCalor]);
  const picoHora = useMemo(() => {
    let m = 0;
    let ih: number | null = null;
    for (let h = 0; h < 24; h++) {
      if (byHourVec[h]! > m) {
        m = byHourVec[h]!;
        ih = h;
      }
    }
    return ih;
  }, [byHourVec]);
  const dispersao = useMemo(() => {
    const nz = byHourVec.filter((x) => x > 0);
    return { p10: pctSorted(nz.length ? nz : byHourVec, 10), p50: pctSorted(nz.length ? nz : byHourVec, 50), p90: pctSorted(nz.length ? nz : byHourVec, 90) };
  }, [byHourVec]);

  const grid7 = useMemo(() => heat24x7(mapaCalor), [mapaCalor]);
  const daily7 = useMemo(() => {
    const dias = [...seriesDia].sort((a, b) => a.dia.localeCompare(b.dia)).slice(-7);
    return dias.map((d) => d.operacoes);
  }, [seriesDia]);
  const dayLabs = useMemo(() => {
    const dias = [...seriesDia].sort((a, b) => a.dia.localeCompare(b.dia)).slice(-7);
    return dias.map((d) => d.dia.slice(5));
  }, [seriesDia]);

  const snap = dash?.snapshot as
    | {
        unidadesEmPortaria?: number;
        unidadesEmGate?: number;
        unidadesNoPatio?: number;
        unidadesEmSaidaPendente?: number;
      }
    | undefined;

  const gargRows =
    gar?.horizontes?.map((h) => ({
      horas: h.horas,
      p: h.probabilidadePortaria,
      g: h.probabilidadeGate,
      pat: h.probabilidadePatio,
      sai: h.probabilidadeSaida,
    })) ?? [];

  const atualPct = typeof cap?.fatorSaturacaoPct === "number" ? cap.fatorSaturacaoPct : (proj as { saturacaoAtualPct?: number })?.saturacaoAtualPct ?? 0;
  const projecoes =
    (proj?.projecoes as { dias: number; saturacaoPatioPrevistaPct: number; confiancaPct: number }[])?.map((x) => ({
      dias: x.dias,
      saturacaoPatioPrevistaPct: x.saturacaoPatioPrevistaPct,
      confiancaPct: x.confiancaPct,
    })) ?? [];

  const operadores =
    prodHum?.produtividadePorOperador?.map((o) => ({
      id: o.usuarioId,
      label: o.email?.split("@")[0] ?? o.usuarioId.slice(0, 8),
      value: o.operacoes24h,
    })) ?? [];
  const turnos = prodHum?.produtividadePorTurno
    ? [
        { label: "Manhã", value: prodHum.produtividadePorTurno.manha },
        { label: "Tarde", value: prodHum.produtividadePorTurno.tarde },
        { label: "Noite", value: prodHum.produtividadePorTurno.noite },
      ]
    : [];
  const etapas = snap
    ? [
        { label: "Port.", value: snap.unidadesEmPortaria ?? 0 },
        { label: "Gate", value: snap.unidadesEmGate ?? 0 },
        { label: "Pátio", value: snap.unidadesNoPatio ?? 0 },
        { label: "Saída", value: snap.unidadesEmSaidaPendente ?? 0 },
      ]
    : [];

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
            <p className="mb-2 font-bold uppercase tracking-wider text-cyan-500/80">Índice</p>
            <ul className="space-y-1">
              {TOC.map((t) => (
                <li key={t.id}>
                  <a href={`#${t.id}`} className="block rounded px-2 py-1 text-zinc-400 hover:bg-white/5 hover:text-cyan-300">
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
            Fontes: <code className="text-zinc-400">/dashboard-performance</code>, <code className="text-zinc-400">/dashboard</code>,{" "}
            <code className="text-zinc-400">/simulador/*</code>, <code className="text-zinc-400">/ia/gargalos</code>.
            {previsoesNote ? ` · ${previsoesNote}` : ""}
          </p>

          <BiSection id="forecast" title="Forecast de demanda" subtitle="Projeção a partir da série diária (performance) · horizontes 14 / 30 / 60 dias">
            <div className="mb-4 flex flex-wrap gap-2">
              {([14, 30, 60] as const).map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHorizon(h)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-semibold",
                    horizon === h ? "bg-cyan-600 text-white" : "bg-white/5 text-zinc-400 hover:bg-white/10",
                  )}
                >
                  {h} dias
                </button>
              ))}
            </div>
            {forecast.labels.length ? <ForecastLineChart labels={forecast.labels} series={forecast.series} /> : <p className="text-sm text-zinc-500">Sem série histórica suficiente.</p>}
          </BiSection>

          <BiSection id="patio" title="Saturação de pátio" subtitle="Estado atual (capacidade) e trilha prevista (7 / 14 / 30 dias)">
            <div className="mb-4 grid gap-3 sm:grid-cols-4 text-xs">
              <div className="rounded-lg border border-white/10 bg-zinc-950/60 p-3">
                <p className="text-zinc-500">Dwell médio (ciclo)</p>
                <p className="font-mono text-lg text-white">{estr?.tempoMedioDeCicloCompletoHoras != null ? `${estr.tempoMedioDeCicloCompletoHoras.toFixed(2)} h` : "—"}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-zinc-950/60 p-3">
                <p className="text-zinc-500">Solicitações (90d)</p>
                <p className="font-mono text-lg text-white">{relSol?.total ?? "—"}</p>
              </div>
              <div className="rounded-lg border border-cyan-500/20 bg-cyan-950/20 p-3 sm:col-span-2">
                <p className="text-zinc-500">Slots / ocupação (API capacidade)</p>
                <p className="font-mono text-sm text-cyan-200">
                  {(cap?.ocupacaoAtualUnidades as number) ?? "—"} / {(cap?.capacidadePatioSlotsTotal as number) ?? "—"} un. · gate pico{" "}
                  {(cap?.capacidadeGateUnidadesPorHoraPico as number)?.toFixed?.(1) ?? "—"} u/h
                </p>
              </div>
            </div>
            {projecoes.length ? (
              <SaturacaoProjectionChart atualPct={atualPct} projecoes={projecoes} />
            ) : (
              <p className="text-sm text-amber-200/80">Projeção indisponível (permissão ou erro de carga).</p>
            )}
          </BiSection>

          <BiSection id="throughput" title="Throughput operacional" subtitle="KPIs, dispersão horária e picos (últimas 24h · agregado 7d)">
            <ThroughputPanel
              portaria={estr?.throughputPortaria ?? null}
              gate={estr?.throughputGate ?? null}
              patio={estr?.throughputPatio ?? null}
              saida={saidaProxy}
              picoHora={picoHora}
              p10={dispersao.p10}
              p50={dispersao.p50}
              p90={dispersao.p90}
              highlightHora={picoHora}
            />
            <div className="mt-6">
              <ThroughputProfileChart hourly24={byHourVec} daily7={daily7.length ? daily7 : [0]} dayLabels={dayLabs.length ? dayLabs : ["—"]} highlightHora={picoHora} />
            </div>
          </BiSection>

          <BiSection id="gargalos" title="IA · risco de gargalo" subtitle="/ia/gargalos — horizontes 2h · 4h · 8h">
            {gargRows.length ? <GargaloRiskMatrix rows={gargRows} /> : <p className="text-sm text-zinc-500">Sem dados de previsão.</p>}
          </BiSection>

          <BiSection id="workload" title="Curva de carga operacional" subtitle="Operadores, turnos e estágio (snapshot do dashboard)">
            <WorkloadDistribution byOperador={operadores} byTurno={turnos.length ? turnos : [{ label: "—", value: 0 }]} byEtapa={etapas.length ? etapas : [{ label: "—", value: 0 }]} />
          </BiSection>

          <BiSection id="heatmap" title="Heatmap 24h × 7 dias" subtitle="Densidade derivada de mapaCalorPorHora (peso semanal front-only)">
            <HeatmapOperationalGrid grid={grid7} dayLabels={["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]} />
          </BiSection>
        </div>
      </div>
    </BiWorkspace>
  );
}
