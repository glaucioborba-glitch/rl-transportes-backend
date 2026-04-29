"use client";

import { useCallback, useMemo } from "react";
import { AiConsoleChat } from "@/components/ai-console/ai-console-chat";
import { InsightPanel } from "@/components/ai-console/insight-panel";
import { EventPriorityList } from "@/components/ai-console/event-priority-list";
import { OperationalDiagnosisCard } from "@/components/ai-console/operational-diagnosis-card";
import { HeuristicEngineFrontend } from "@/components/ai-console/heuristic-engine-frontend";
import { useOperationalAiConsole } from "@/lib/ai-console/use-operational-ai-console";
import {
  answerOperationalQuestion,
  buildEventPriorityList,
  buildOperationalRecommendations,
  buildRootCausesLite,
  buildStateTicker,
} from "@/lib/ai-console/heuristic-engine";
import { Button } from "@/components/ui/button";

export default function AiConsoleOperacionalPage() {
  const { bundle, snap, refresh } = useOperationalAiConsole(true);

  const ticker = useMemo(() => {
    if (!snap || !bundle) return "";
    return buildStateTicker(snap, bundle.gar);
  }, [snap, bundle]);

  const priorities = useMemo(() => {
    if (!snap || !bundle) return [];
    return buildEventPriorityList(snap, bundle.gar);
  }, [snap, bundle]);

  const roots = useMemo(() => (snap ? buildRootCausesLite(snap) : []), [snap]);
  const reco = useMemo(() => (snap ? buildOperationalRecommendations(snap) : []), [snap]);

  const onAsk = useCallback(
    (q: string) => {
      if (!snap || !bundle) return { text: "Aguardando dados do terminal…", priority: "P3" as const };
      const r = answerOperationalQuestion(q, snap, bundle.gar);
      return { text: r.reply, priority: r.priority };
    },
    [snap, bundle],
  );

  if (!bundle || !snap) {
    return (
      <>
        <p className="text-zinc-500">Carregando copiloto operacional…</p>
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
          <h1 className="text-3xl font-light text-white">AI Console · Operacional</h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-500">
            Copiloto TOC/NOC com heurísticas locais sobre <code className="text-zinc-600">/dashboard</code>, desempenho, capacidade, projeções e{" "}
            <code className="text-zinc-600">/ia/gargalos</code>. Atualização ~10s.
            {bundle.prevNote ? " · Endpoint auxiliar /ia-operacional/previsoes detectado." : ""}
          </p>
        </div>
        <Button type="button" variant="outline" className="border-violet-500/40" onClick={() => void refresh()}>
          Sincronizar
        </Button>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-5">
          <AiConsoleChat title="Pergunte ao terminal" placeholder="Ex.: Qual é o gargalo agora?" onAsk={onAsk} />
          <HeuristicEngineFrontend />
        </div>
        <div className="space-y-4 xl:col-span-7">
          <InsightPanel ticker={ticker} updatedAt={bundle.updatedAt} />
          <EventPriorityList items={priorities} />
          <OperationalDiagnosisCard hypotheses={roots} />
          <div className="rounded-2xl border border-white/10 bg-[#080818] p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-300/80">Recomendações operacionais</p>
            <ul className="mt-3 list-inside list-decimal space-y-1.5 text-xs text-zinc-300">
              {reco.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
