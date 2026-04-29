"use client";

import { useCallback, useEffect, useState } from "react";
import { BiWorkspace } from "@/components/bi/bi-workspace";
import { BiSection } from "@/components/bi/bi-section";
import { RoiCard } from "@/components/bi/roi-card";
import { WhatIfConfigurator } from "@/components/bi/what-if-configurator";
import { CorporateRiskMatrix } from "@/components/bi/corporate-risk-matrix";
import { CapexSimulationChart } from "@/components/bi/capex-simulation-chart";
import { ExecutiveRecommendationTile } from "@/components/bi/executive-recommendation-tile";
import { ApiError, staffJson } from "@/lib/api/staff-client";
import { toast } from "@/lib/toast";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TOC = [
  { id: "roi", label: "ROI expansão" },
  { id: "whatif", label: "What-if" },
  { id: "risco", label: "Riscos" },
  { id: "capex", label: "Expansão" },
  { id: "exec", label: "Diretoria" },
] as const;

type Cenario = {
  impactoNaSaturacaoPctPontos: number;
  saturacaoResultantePct: number;
  impactoNoCicloMinutos: number;
  cicloResultanteMinutos: number;
  necessidadeExpansaoSlots: number;
  throughputEsperadoUph: number;
  gargalosProvaveis: string[];
};

type Expansao = {
  ganhoSlots: number;
  roiOperacionalProxy: number;
  mesesPaybackProxy: number | null;
  impactoCicloMinutosEstimado: number;
  saturacaoAtualPct: number;
  saturacaoAposExpansaoPct: number;
};

function cenarioQs(q: {
  aumentoDemandaPercentual?: number;
  reducaoTurnoHoras?: number;
  aumentoTurnoHoras?: number;
  expansaoQuadras?: number;
  novoClienteVolumeEstimado?: number;
}) {
  const p = new URLSearchParams();
  if (q.aumentoDemandaPercentual != null && q.aumentoDemandaPercentual !== 0) {
    p.set("aumentoDemandaPercentual", String(q.aumentoDemandaPercentual));
  }
  if (q.reducaoTurnoHoras != null && q.reducaoTurnoHoras !== 0) p.set("reducaoTurnoHoras", String(q.reducaoTurnoHoras));
  if (q.aumentoTurnoHoras != null && q.aumentoTurnoHoras !== 0) p.set("aumentoTurnoHoras", String(q.aumentoTurnoHoras));
  if (q.expansaoQuadras != null && q.expansaoQuadras !== 0) p.set("expansaoQuadras", String(q.expansaoQuadras));
  if (q.novoClienteVolumeEstimado != null && q.novoClienteVolumeEstimado !== 0) {
    p.set("novoClienteVolumeEstimado", String(q.novoClienteVolumeEstimado));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

const TIPO_LABEL: Record<string, string> = {
  reajuste: "Reajuste",
  pacote: "Pacote",
  contrato: "Contrato",
  ocupacao: "Ocupação",
  alerta: "Alerta",
  desconto: "Desconto",
};

export default function BiCorporativoPage() {
  const allowed = useStaffAuthStore((s) => s.user?.role === "ADMIN" || s.user?.role === "GERENTE");
  const [exp, setExp] = useState<Expansao | null>(null);
  const [cenario, setCenario] = useState<Cenario | null>(null);
  const [proj, setProj] = useState<{ saturacaoAtualPct?: number; projecoes?: { dias: number; saturacaoPatioPrevistaPct: number }[] } | null>(null);
  const [gar, setGar] = useState<{ horizontes?: { probabilidadePortaria: number; probabilidadePatio: number }[] } | null>(null);
  const [rec, setRec] = useState<{ recomendacoes?: { tipo: string; titulo: string; descricao: string; prioridade?: string }[] } | null>(null);
  const [perfOc, setPerfOc] = useState<{ estrategicos?: { ocupacaoPatioPercent?: number | null } } | null>(null);

  const load = useCallback(async () => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 90);
    const di = start.toISOString().slice(0, 10);
    const df = end.toISOString().slice(0, 10);
    try {
        const [e, p, g, r, perf] = await Promise.all([
        staffJson<Expansao>(`/simulador/expansao?quadrasAdicionais=2`).catch(() => null),
        staffJson<typeof proj>(`/simulador/projecao-saturacao`).catch(() => null),
        staffJson<typeof gar>(`/ia/gargalos`).catch(() => null),
        staffJson<typeof rec>(`/comercial/recomendacoes?dataInicio=${di}&dataFim=${df}`),
        staffJson<typeof perfOc>(`/dashboard-performance`).catch(() => null),
      ]);
      setExp(e);
      setProj(p);
      setGar(g);
      setRec(r);
      setPerfOc(perf);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Falha BI corporativo");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function runCenario(q: Parameters<typeof cenarioQs>[0]) {
    try {
      const path = `/simulador/cenario${cenarioQs(q)}`;
      const r = await staffJson<Cenario>(path);
      setCenario(r);
      toast.success("Cenário calculado");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro no simulador");
    }
  }

  const maxP =
    gar?.horizontes?.reduce((m, h) => Math.max(m, h.probabilidadePortaria, h.probabilidadePatio), 0) ?? 0;
  const satProj = proj?.projecoes?.find((x) => x.dias === 30)?.saturacaoPatioPrevistaPct ?? proj?.projecoes?.[0]?.saturacaoPatioPrevistaPct ?? 0;
  const riskCells = [
    {
      id: "ia",
      label: "Congestionamento IA",
      impacto: Math.round(maxP * 100),
      prob: Math.round(40 + maxP * 40),
      nota: "Máx. prob. portaria/pátio (2–8h).",
    },
    {
      id: "sat",
      label: "Saturação 30d",
      impacto: Math.min(100, Math.round(satProj)),
      prob: Math.min(100, Math.round(satProj * 0.85)),
      nota: "/simulador/projecao-saturacao",
    },
    {
      id: "oc",
      label: "Ocupação instantânea",
      impacto: Math.min(100, Math.round(perfOc?.estrategicos?.ocupacaoPatioPercent ?? satProj * 0.9)),
      prob: 35,
      nota: "/dashboard-performance",
    },
    {
      id: "com",
      label: "Comercial",
      impacto: Math.min(100, (rec?.recomendacoes?.filter((x) => x.prioridade === "alta").length ?? 0) * 22),
      prob: 50,
      nota: "Contagem de recomendações prioritárias.",
    },
  ];

  const tiles = (rec?.recomendacoes ?? []).map((x) => ({
    tipo: TIPO_LABEL[x.tipo] ?? x.tipo,
    titulo: x.titulo,
    descricao: x.descricao,
    prioridade: x.prioridade,
  }));

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
              <p className="mb-2 font-bold uppercase tracking-wider text-blue-500/90">Índice</p>
              <ul className="space-y-1">
                {TOC.map((t) => (
                  <li key={t.id}>
                    <a href={`#${t.id}`} className="block rounded px-2 py-1 text-zinc-400 hover:bg-white/5 hover:text-blue-300">
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
              Rotas consolidadas: <code className="text-zinc-400">/simulador/*</code>, <code className="text-zinc-400">/ia/gargalos</code>,{" "}
              <code className="text-zinc-400">/comercial/recomendacoes</code>, <code className="text-zinc-400">/dashboard-performance</code>.
            </p>

            <BiSection id="roi" title="ROI operacional (expansão)" subtitle="GET /simulador/expansao — proxy de retorno e ciclo">
              <div className="grid gap-4 lg:grid-cols-2">
                {exp ? (
                  <RoiCard
                    title="Cenário base · +2 quadras"
                    ganhoSlots={exp.ganhoSlots}
                    roiProxy={exp.roiOperacionalProxy}
                    paybackMeses={exp.mesesPaybackProxy ?? null}
                    impactoCicloMin={exp.impactoCicloMinutosEstimado}
                  />
                ) : (
                  <p className="text-sm text-zinc-500">Carregando expansão…</p>
                )}
                <div className="rounded-2xl border border-white/10 bg-zinc-950/50 p-4 text-sm text-zinc-400">
                  <p className="font-semibold text-blue-200">Leitura executiva</p>
                  <p className="mt-2">
                    Saturação atual <span className="font-mono text-white">{exp?.saturacaoAtualPct?.toFixed?.(1) ?? "—"}%</span> → após expansão{" "}
                    <span className="font-mono text-cyan-300">{exp?.saturacaoAposExpansaoPct?.toFixed?.(1) ?? "—"}%</span>
                  </p>
                  <p className="mt-2 text-[11px] text-zinc-600">Payback e ROI são proxies configuráveis no backend; comparar cenários relativamente.</p>
                </div>
              </div>
            </BiSection>

            <BiSection id="whatif" title="Matriz What-if" subtitle="Sala de guerra — GET /simulador/cenario">
              <WhatIfConfigurator onRun={runCenario} />
              {cenario ? (
                <div
                  className={cn(
                    "mt-4 grid gap-3 rounded-2xl border p-4 text-sm",
                    "border-violet-500/30 bg-gradient-to-br from-violet-950/40 to-zinc-950/80",
                  )}
                >
                  <p className="font-bold uppercase tracking-wider text-violet-300">Resultado</p>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <p className="text-zinc-500">Saturação resultante</p>
                      <p className="font-mono text-lg text-white">{cenario.saturacaoResultantePct.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Δ saturação (p.p.)</p>
                      <p className="font-mono text-lg text-amber-200">{cenario.impactoNaSaturacaoPctPontos.toFixed(1)}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Throughput esperado</p>
                      <p className="font-mono text-lg text-cyan-300">{cenario.throughputEsperadoUph.toFixed(1)} u/h</p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Ciclo (min)</p>
                      <p className="font-mono text-lg text-white">{cenario.cicloResultanteMinutos.toFixed(0)}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Δ ciclo (min)</p>
                      <p className="font-mono text-lg text-zinc-300">{cenario.impactoNoCicloMinutos.toFixed(1)}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Slots necessários</p>
                      <p className="font-mono text-lg text-white">{cenario.necessidadeExpansaoSlots}</p>
                    </div>
                  </div>
                  {cenario.gargalosProvaveis?.length ? (
                    <div>
                      <p className="text-xs text-zinc-500">Gargalos prováveis</p>
                      <ul className="list-disc pl-5 text-zinc-300">
                        {cenario.gargalosProvaveis.map((g) => (
                          <li key={g}>{g}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </BiSection>

            <BiSection id="risco" title="Matriz de riscos corporativos" subtitle="Impacto × probabilidade (composto de APIs)">
              <CorporateRiskMatrix cells={riskCells} />
            </BiSection>

            <BiSection id="capex" title="Análise de expansão física" subtitle="Comparativo de saturação antes/depois">
              {exp ? (
                <div className="flex flex-wrap items-center gap-8">
                  <CapexSimulationChart atual={exp.saturacaoAtualPct} apos={exp.saturacaoAposExpansaoPct} labels={["Atual", "Pós-expansão"]} />
                  <div className="text-sm text-zinc-400">
                    <p>
                      Redução <span className="font-mono text-emerald-300">{(exp.saturacaoAtualPct - exp.saturacaoAposExpansaoPct).toFixed(1)} p.p.</span> na
                      saturação proxy.
                    </p>
                    <p className="mt-2 text-[11px] text-zinc-600">CapEx não exposto na API — use ROI/payback como referência relativa.</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-zinc-500">Sem dados de expansão.</p>
              )}
            </BiSection>

            <BiSection id="exec" title="Recomendações executivas" subtitle="/comercial/recomendacoes">
              {tiles.length ? <ExecutiveRecommendationTile items={tiles} /> : <p className="text-sm text-zinc-500">Sem recomendações no período.</p>}
            </BiSection>
          </div>
        </div>
      </BiWorkspace>
    );
}
