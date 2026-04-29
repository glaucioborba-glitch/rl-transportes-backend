"use client";

import { useCallback, useMemo, useState } from "react";
import { DirectorAutopilot } from "@/components/sdt/director-autopilot";
import { ScenarioBuilder } from "@/components/sdt/scenario-builder";
import { ExpansionAdvisor } from "@/components/sdt/expansion-advisor";
import { LongTermRiskMap } from "@/components/sdt/long-term-risk-map";
import { StrategicRecommender } from "@/components/sdt/strategic-recommender";
import { useSdtStrategic, type SdtStrategicBundle } from "@/lib/sdt/use-sdt-strategic";
import { answerDirectorQuestion, buildScenarioQueryForProfile, type ScenarioProfile } from "@/lib/sdt/director-heuristics";
import { staffJson, ApiError } from "@/lib/api/staff-client";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";

function buildStrategicLines(bundle: SdtStrategicBundle | null): string[] {
  if (!bundle) return [];
  const rec = bundle.rec as { recomendacoes?: { titulo: string; descricao?: string }[] } | undefined;
  const fromApi = (rec?.recomendacoes ?? []).map((r) => `${r.titulo}${r.descricao ? ` — ${r.descricao}` : ""}`);
  const sat = Number((bundle.cap as { fatorSaturacaoPct?: number } | undefined)?.fatorSaturacaoPct ?? 0);
  const perf = bundle.perf?.estrategicos as { taxaGargaloDetectado?: boolean } | undefined;
  const extra: string[] = [];
  if (sat > 82) extra.push("Expandir quadras ou reforçar turnos antes de assumir novos contratos de grande volume.");
  if (perf?.taxaGargaloDetectado) extra.push("Ampliar capacidade efetiva de gate ou automatizar verificações repetitivas.");
  extra.push("Diversificar base de clientes conforme curva ABC comercial para reduzir risco de concentração.");
  extra.push("Renegociar contratos de baixa margem integrando dados de performance e inadimplência.");
  return [...fromApi.slice(0, 5), ...extra].slice(0, 12);
}

export default function SdtEstrategicoPage() {
  const { bundle, refresh } = useSdtStrategic();
  const [lastCenario, setLastCenario] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  const onDirectorAsk = useCallback(
    async (q: string) => {
      const r = answerDirectorQuestion(q, bundle, lastCenario);
      setLoading(true);
      try {
        const c = await staffJson<Record<string, unknown>>(`/simulador/cenario${r.qsHint}`);
        setLastCenario(c);
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "Falha no simulador de cenário");
      } finally {
        setLoading(false);
      }
      return { headline: r.headline, body: r.body };
    },
    [bundle, lastCenario],
  );

  const onScenarioRun = useCallback(async (p: ScenarioProfile) => {
    setLoading(true);
    try {
      const qs = buildScenarioQueryForProfile(p);
      const c = await staffJson<Record<string, unknown>>(`/simulador/cenario${qs}`);
      setLastCenario(c);
      toast.success("Cenário carregado");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha no cenário");
    } finally {
      setLoading(false);
    }
  }, []);

  const lines = useMemo(() => buildStrategicLines(bundle), [bundle]);

  const satPct = Number((bundle?.cap as { fatorSaturacaoPct?: number } | undefined)?.fatorSaturacaoPct ?? 0);
  const inad = bundle?.fin?.inadimplencia as { forecastInadimplenciaPercent?: number | null } | undefined;
  const rent = bundle?.fin?.rentabilidade as { proxyMargemOperacional?: number | null } | undefined;
  const rawM = Number(rent?.proxyMargemOperacional ?? NaN);
  const margemPct = Number.isFinite(rawM) ? (rawM <= 1 && rawM > 0 ? rawM * 100 : rawM) : 16;

  if (!bundle) {
    return (
      <div className="space-y-4">
        <p className="text-zinc-500">Carregando autonomia estratégica…</p>
        <Button type="button" variant="outline" className="border-slate-500/40" onClick={() => void refresh()}>
          Tentar agora
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-light text-white">Strategic autonomy</h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-500">
            Cenários, ROI e recomendações executivas usando apenas endpoints existentes. Simulação e texto são locais ao
            navegador.
          </p>
        </div>
        <Button type="button" variant="outline" className="border-slate-500/40" onClick={() => void refresh()}>
          Sincronizar
        </Button>
      </div>

      <DirectorAutopilot loading={loading} onAsk={onDirectorAsk} />

      <ScenarioBuilder loading={loading} onRun={(p) => void onScenarioRun(p)} />

      <div className="grid gap-6 xl:grid-cols-2">
        <ExpansionAdvisor data={bundle.expansao} cap={bundle.cap} />
        {lastCenario ? (
          <div className="rounded-2xl border border-white/10 bg-black/40 p-4 font-mono text-[10px] text-zinc-400">
            <p className="mb-2 text-[10px] font-bold uppercase text-zinc-500">Último /simulador/cenario</p>
            <pre className="max-h-56 overflow-auto whitespace-pre-wrap">{JSON.stringify(lastCenario, null, 2)}</pre>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 p-6 text-xs text-zinc-600">
            Nenhum cenário carregado ainda — use o Director ou A/B/C.
          </div>
        )}
      </div>

      <LongTermRiskMap satPct={satPct} inadPct={Number(inad?.forecastInadimplenciaPercent ?? 0)} margemPct={margemPct} />
      <StrategicRecommender lines={lines} />
    </div>
  );
}
