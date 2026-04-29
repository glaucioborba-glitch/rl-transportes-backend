"use client";

import { useCallback, useEffect, useState } from "react";
import { ScenarioConfigurator, scenarioDefaults, type ScenarioParams } from "@/components/digital-twin/scenario-configurator";
import { ScenarioImpactChart } from "@/components/digital-twin/scenario-impact-chart";
import { TwinWhatIfMap } from "@/components/digital-twin/twin-what-if-map";
import { RoiSimulationCard } from "@/components/digital-twin/roi-simulation-card";
import { AiStrategicRecommender } from "@/components/digital-twin/ai-strategic-recommender";
import { buildCenarioQuery, buildExpansaoQuery, buildTurnosQuery } from "@/lib/digital-twin/cenario-qs";
import { twinScenarioList, twinScenarioSave, type SavedWhatIfScenario } from "@/lib/digital-twin/scenario-storage";
import { ApiError, staffJson, staffTryJson } from "@/lib/api/staff-client";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";

type CenarioRes = {
  saturacaoResultantePct?: number;
  throughputEsperadoUph?: number;
  gargalosProvaveis?: string[];
  impactoNaSaturacaoPctPontos?: number;
  cicloResultanteMinutos?: number;
};

export default function DigitalTwinWhatIfPage() {
  const [params, setParams] = useState<ScenarioParams>({ ...scenarioDefaults });
  const [loading, setLoading] = useState(false);
  const [cenario, setCenario] = useState<CenarioRes | null>(null);
  const [expansao, setExpansao] = useState<Record<string, unknown> | null>(null);
  const [turnos, setTurnos] = useState<Record<string, unknown> | null>(null);
  const [perf, setPerf] = useState<Record<string, unknown> | null>(null);
  const [rec, setRec] = useState<{ recomendacoes?: Record<string, unknown>[] } | null>(null);
  const [abc, setAbc] = useState<{ tag: string; c: CenarioRes | null }[]>([]);
  const [saved, setSaved] = useState<SavedWhatIfScenario[]>([]);

  const boot = useCallback(async () => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 90);
    const di = start.toISOString().slice(0, 10);
    const df = end.toISOString().slice(0, 10);
    try {
      const [p, r] = await Promise.all([
        staffJson<Record<string, unknown>>(`/dashboard-performance`),
        staffTryJson<{ recomendacoes?: Record<string, unknown>[] }>(`/comercial/recomendacoes?dataInicio=${di}&dataFim=${df}`),
      ]);
      setPerf(p);
      setRec(r);
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message);
    }
  }, []);

  useEffect(() => {
    void boot();
    setSaved(twinScenarioList());
  }, [boot]);

  const runCore = useCallback(
    async (p: ScenarioParams) => {
      const cq = buildCenarioQuery({
        aumentoDemandaPercentual: p.aumentoDemandaPercentual,
        reducaoTurnoHoras: p.reducaoTurnoHoras,
        aumentoTurnoHoras: p.aumentoTurnoHoras,
        expansaoQuadras: p.expansaoQuadras,
        novoClienteVolumeEstimado: p.novoClienteVolumeEstimado,
      });
      const c = await staffJson<CenarioRes>(`/simulador/cenario${cq}`);
      const eq = buildExpansaoQuery({
        quadrasAdicionais: p.quadrasAdicionais,
        slotsPorQuadraEstimado: p.slotsPorQuadraEstimado,
      });
      const tq = buildTurnosQuery({
        reducaoTurno: p.reducaoTurno || undefined,
        aumentoTurno: p.aumentoTurno || undefined,
      });
      const e = await (async () => {
        try {
          return await staffJson<Record<string, unknown>>(`/simulador/expansao${eq}`);
        } catch {
          return null;
        }
      })();
      const t = await (async () => {
        try {
          return await staffJson<Record<string, unknown>>(`/simulador/turnos${tq}`);
        } catch {
          return null;
        }
      })();
      return { c, e, t };
    },
    [],
  );

  const onRun = useCallback(async () => {
    setLoading(true);
    try {
      const { c, e, t } = await runCore(params);
      setCenario(c);
      setExpansao(e);
      setTurnos(t);
      const row: SavedWhatIfScenario = {
        id: crypto.randomUUID(),
        name: `Cenário ${new Date().toLocaleString("pt-BR")}`,
        at: new Date().toISOString(),
        params: { ...params },
        cenario: c as Record<string, unknown>,
        expansao: e,
        turnos: t,
      };
      twinScenarioSave(row);
      setSaved(twinScenarioList());
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha na simulação");
    } finally {
      setLoading(false);
    }
  }, [params, runCore]);

  const onGenerateABC = useCallback(async () => {
    setLoading(true);
    try {
      const packs: ScenarioParams[] = [
        { ...params, aumentoDemandaPercentual: Math.max(5, params.aumentoDemandaPercentual * 0.6), expansaoQuadras: 0 },
        { ...params, aumentoDemandaPercentual: params.aumentoDemandaPercentual, expansaoQuadras: 1 },
        {
          ...params,
          aumentoDemandaPercentual: Math.min(45, params.aumentoDemandaPercentual * 1.4),
          reducaoTurnoHoras: 2,
          quadrasAdicionais: 3,
        },
      ];
      const out: { tag: string; c: CenarioRes | null }[] = [];
      for (let i = 0; i < packs.length; i++) {
        const { c } = await runCore(packs[i]!);
        out.push({ tag: ["A", "B", "C"][i]!, c });
      }
      setAbc(out);
      toast.success("Cenários A/B/C calculados.");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha A/B/C");
    } finally {
      setLoading(false);
    }
  }, [params, runCore]);

  const gar = perf?.estrategicos as { taxaGargaloDetectado?: boolean } | undefined;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-light text-white">What-if strategist</h1>
        <p className="mt-2 max-w-3xl text-sm text-zinc-500">
          Combinação de simuladores existentes + insights comerciais. Cenários salvos apenas no navegador.
        </p>
      </div>

      <ScenarioConfigurator
        value={params}
        onChange={setParams}
        onRun={() => void onRun()}
        onGenerateABC={() => void onGenerateABC()}
        loading={loading}
      />

      <div className="grid gap-6 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-7">
          <div className="rounded-2xl border border-cyan-500/20 bg-[#060914] p-5">
            <p className="text-[10px] font-bold uppercase text-cyan-300/90">Impacto · /simulador/cenario</p>
            {cenario ? (
              <ul className="mt-3 space-y-2 font-mono text-sm text-zinc-300">
                <li>Saturação resultante: {Number(cenario.saturacaoResultantePct ?? 0).toFixed(1)}%</li>
                <li>Δ saturação: {Number(cenario.impactoNaSaturacaoPctPontos ?? 0).toFixed(1)} p.p.</li>
                <li>Throughput esperado: {Number(cenario.throughputEsperadoUph ?? 0).toFixed(1)} u/h</li>
                <li>Ciclo resultante: {Number(cenario.cicloResultanteMinutos ?? 0).toFixed(0)} min</li>
                <li className="pt-2 text-[11px] text-amber-200/90">
                  Gargalos: {(cenario.gargalosProvaveis ?? []).join(" · ") || "—"}
                </li>
              </ul>
            ) : (
              <p className="mt-3 text-sm text-zinc-600">Aguardando simulação.</p>
            )}
          </div>
          <RoiSimulationCard data={expansao} />
          <div className="rounded-2xl border border-white/10 bg-[#050810] p-5">
            <p className="text-[10px] font-bold uppercase text-zinc-500">Turnos · /simulador/turnos</p>
            <pre className="mt-2 max-h-48 overflow-auto text-[10px] text-zinc-400">
              {turnos ? JSON.stringify(turnos, null, 2) : "{}"}
            </pre>
          </div>
        </div>
        <div className="space-y-4 xl:col-span-5">
          <TwinWhatIfMap
            satPct={Number(cenario?.saturacaoResultantePct ?? 55)}
            riskLabel={
              gar?.taxaGargaloDetectado
                ? "Cenário sob pressão: alinhar com gargalo detectado na performance."
                : "Projeção operacional derivada do cenário ativo."
            }
            criticalQuadras={(cenario?.gargalosProvaveis ?? []).filter((g) => /quadra|pátio|gate/i.test(String(g)))}
          />
          <ScenarioImpactChart
            labels={abc.length ? abc.map((x) => x.tag) : ["Baseline", "Atual", "Stretch"]}
            saturacao={
              abc.length
                ? abc.map((x) => Number(x.c?.saturacaoResultantePct ?? 0))
                : [40, Number(cenario?.saturacaoResultantePct ?? 55), 72]
            }
            throughput={
              abc.length
                ? abc.map((x) => Number(x.c?.throughputEsperadoUph ?? 0))
                : [6, Number(cenario?.throughputEsperadoUph ?? 8), 10]
            }
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-fuchsia-500/25 bg-[#080510] p-5">
          <p className="text-[10px] font-bold uppercase text-fuchsia-300/90">Painel inteligente · /comercial/recomendacoes</p>
          <div className="mt-3">
            <AiStrategicRecommender recs={(rec?.recomendacoes ?? []) as { tipo?: string; titulo?: string; descricao?: string; prioridade?: string }[]} />
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#060910] p-5">
          <p className="text-[10px] font-bold uppercase text-zinc-500">Cenários salvos (local)</p>
          {saved.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-600">Nenhum registro ainda.</p>
          ) : (
            <ul className="mt-3 max-h-64 space-y-2 overflow-auto text-xs text-zinc-400">
              {saved.slice(0, 8).map((s) => (
                <li key={s.id} className="rounded-lg border border-white/5 px-3 py-2">
                  <p className="font-medium text-zinc-200">{s.name}</p>
                  <p className="font-mono text-[10px] text-zinc-600">
                    Sat {Number((s.cenario as CenarioRes | null)?.saturacaoResultantePct ?? 0).toFixed(1)}%
                  </p>
                </li>
              ))}
            </ul>
          )}
          <Button type="button" variant="ghost" className="mt-3 text-zinc-500" onClick={() => setSaved(twinScenarioList())}>
            Atualizar lista
          </Button>
        </div>
      </div>
    </div>
  );
}
