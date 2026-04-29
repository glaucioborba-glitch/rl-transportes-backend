"use client";

import { useCallback, useMemo, useState } from "react";
import { StrategicChat } from "@/components/ai-console/strategic-chat";
import { ScenarioBoard } from "@/components/ai-console/scenario-board";
import { StrategicRiskPanel } from "@/components/ai-console/strategic-risk-panel";
import { ExpansionRoiViewer } from "@/components/ai-console/expansion-roi-viewer";
import { ExecutiveSynthesis } from "@/components/ai-console/executive-synthesis";
import { useStrategicAiConsole } from "@/lib/ai-console/use-strategic-ai-console";
import { answerStrategicQuestion, strategicRiskScore } from "@/lib/ai-console/heuristic-engine";
import { maxGargaloProb } from "@/lib/ai-console/operational-snapshot";
import { staffJson, ApiError } from "@/lib/api/staff-client";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { modeLabel } from "@/lib/digital-twin/derive";

export default function AiConsoleEstrategicoPage() {
  const { bundle, snap, refresh } = useStrategicAiConsole(true);
  const [sim, setSim] = useState<Record<string, unknown> | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  const fin = bundle?.fin;
  const rent = fin?.rentabilidade as { proxyMargemOperacional?: number | null } | undefined;
  const rawM = Number(rent?.proxyMargemOperacional ?? NaN);
  const margemFin = Number.isFinite(rawM) ? (rawM <= 1 && rawM > 0 ? rawM * 100 : rawM) : null;

  const rec = bundle?.rec as { recomendacoes?: { titulo: string }[] } | undefined;
  const recTitles = (rec?.recomendacoes ?? []).map((r) => r.titulo);

  const cenarioEfetivo = sim ?? bundle?.cenario ?? null;

  const garProb = useMemo(() => maxGargaloProb(bundle?.gar ?? null), [bundle?.gar]);

  const risk = useMemo(
    () =>
      strategicRiskScore({
        snap,
        finMargem: margemFin,
        recCount: recTitles.length,
        garProb,
      }),
    [snap, margemFin, recTitles.length, garProb],
  );

  const synthesis = useMemo(() => {
    const cap = bundle?.cap as { fatorSaturacaoPct?: number } | undefined;
    const sat = snap?.sat ?? cap?.fatorSaturacaoPct ?? 0;
    const ce = cenarioEfetivo as { saturacaoPrevistaPct?: number } | undefined;
    const parts = [
      `Terminal em modo ${snap ? modeLabel(snap.mode) : "n/d"} com saturação corrente ~${sat.toFixed(0)}%.`,
      ce?.saturacaoPrevistaPct != null ? `Cenário exibido projeta ~${ce.saturacaoPrevistaPct.toFixed(0)}% de saturação.` : "",
      recTitles[0] ? `Sinal comercial prioritário: ${recTitles[0]}.` : "",
      `Score estratégico sintético ${risk.score} — ${risk.label}.`,
    ];
    return parts.filter(Boolean).join(" ");
  }, [snap, bundle?.cap, cenarioEfetivo, recTitles, risk]);

  const onAsk = useCallback(
    (q: string) => {
      const r = answerStrategicQuestion(q, {
        snap,
        cenario: cenarioEfetivo,
        expansao: bundle?.expansao ?? null,
        finMargem: margemFin,
        recTitles,
      });
      return { text: r.reply, priority: r.priority };
    },
    [snap, cenarioEfetivo, bundle?.expansao, margemFin, recTitles],
  );

  const runSim = useCallback(
    async (qs: string) => {
      setSimLoading(true);
      try {
        const r = await staffJson<Record<string, unknown>>(`/simulador/cenario${qs}`);
        setSim(r);
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "Falha na simulação");
      } finally {
        setSimLoading(false);
      }
    },
    [],
  );

  if (!bundle) {
    return (
      <>
        <p className="text-zinc-500">Carregando copiloto estratégico…</p>
        <Button type="button" variant="outline" className="mt-4 border-violet-500/40" onClick={() => void refresh()}>
          Tentar agora
        </Button>
      </>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-light text-white">AI Console · Estratégico</h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-500">
            Painel diretivo com cenários <code className="text-zinc-600">/simulador/cenario</code>, expansão, finais de capacidade e recomendações
            comerciais — sem persistência além do que a API já expõe.
          </p>
        </div>
        <Button type="button" variant="outline" className="border-violet-500/40" onClick={() => void refresh()}>
          Sincronizar
        </Button>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-5">
          <StrategicChat onAsk={onAsk} />
          <ScenarioBoard onRun={runSim} loading={simLoading} />
          {cenarioEfetivo ? (
            <div className="rounded-xl border border-white/10 bg-black/30 p-3 font-mono text-[10px] text-zinc-400">
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap">{JSON.stringify(cenarioEfetivo, null, 2)}</pre>
            </div>
          ) : null}
        </div>
        <div className="space-y-4 xl:col-span-7">
          <StrategicRiskPanel score={risk.score} label={risk.label} />
          <ExpansionRoiViewer data={bundle.expansao} />
          <ExecutiveSynthesis text={synthesis} />
        </div>
      </div>
    </>
  );
}
