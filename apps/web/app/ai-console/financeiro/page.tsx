"use client";

import { useCallback, useMemo } from "react";
import { CfoChat } from "@/components/ai-console/cfo-chat";
import { PricingAdvisor } from "@/components/ai-console/pricing-advisor";
import { MarginRiskRadar } from "@/components/ai-console/margin-risk-radar";
import { FinancialForecastPanel } from "@/components/ai-console/financial-forecast-panel";
import { ExecutiveAlerts } from "@/components/ai-console/executive-alerts";
import { useFinanceAiConsole } from "@/lib/ai-console/use-finance-ai-console";
import { answerCfoQuestion } from "@/lib/ai-console/heuristic-engine";
import { Button } from "@/components/ui/button";

function extractFinanceAlerts(args: {
  fin: Record<string, unknown> | null;
  ind: Record<string, unknown> | null;
  abcMargem?: number;
}): string[] {
  const inad = args.fin?.inadimplencia as { forecastInadimplenciaPercent?: number | null } | undefined;
  const curva = args.fin?.clientes as { curvaAbc?: { classe: string; faturamento?: number }[] } | undefined;
  const margem = args.ind as { margemMediaPct?: number | null; faturamentoTotal?: number; lucroEstimado?: number } | undefined;
  const lucroPct =
    margem?.faturamentoTotal && margem.faturamentoTotal > 0
      ? ((margem.lucroEstimado ?? 0) / margem.faturamentoTotal) * 100
      : 0;
  const m = margem?.margemMediaPct ?? lucroPct;
  const lines: string[] = [];
  if ((inad?.forecastInadimplenciaPercent ?? 0) > 7) lines.push("Risco financeiro alto: inadimplência projetada acima de 7%.");
  if (m < 12) lines.push("Margem comprimida (abaixo de 12%): revisar pricing em clientes de baixa rentabilidade.");
  const clsC = (curva?.curvaAbc ?? []).filter((x) => x.classe === "C");
  const volC = clsC.reduce((s, x) => s + (x.faturamento ?? 0), 0);
  const total = (curva?.curvaAbc ?? []).reduce((s, x) => s + (x.faturamento ?? 0), 0);
  if (total > 0 && volC / total > 0.35) lines.push("Curva ABC deteriorada: volume relevante na classe C — concentração de risco.");
  if (!lines.length) lines.push("Nenhum alerta crítico sintético; manter monitoramento de concentradores.");
  return lines;
}

export default function AiConsoleFinanceiroPage() {
  const { bundle, refresh } = useFinanceAiConsole(true);

  const indData = bundle?.ind as {
    margemMediaPct?: number | null;
    faturamentoTotal?: number;
    lucroEstimado?: number;
    elasticidadeDemandaMedia?: number | null;
  } | undefined;

  const lucroPct =
    indData?.faturamentoTotal && indData.faturamentoTotal > 0
      ? ((indData.lucroEstimado ?? 0) / indData.faturamentoTotal) * 100
      : 0;
  const margemPct = indData?.margemMediaPct ?? lucroPct;

  const finSnap = bundle?.fin?.snapshot as { mediaTicketPorSolicitacao?: number } | undefined;
  const inad = bundle?.fin?.inadimplencia as {
    forecastInadimplenciaPercent?: number | null;
    forecastFaturamentoProximoMes?: number | null;
  } | undefined;

  const radar = useMemo(
    () => ({
      margem: Math.min(100, Math.max(0, margemPct)),
      ticket: Math.min(100, ((finSnap?.mediaTicketPorSolicitacao ?? 0) / 40_000) * 100),
      lucro: Math.min(100, Math.max(0, lucroPct)),
      container: Math.min(100, margemPct * 0.9 + 10),
      risco: Math.min(100, (inad?.forecastInadimplenciaPercent ?? 0) * 8 + (margemPct < 12 ? 20 : 0)),
    }),
    [margemPct, finSnap?.mediaTicketPorSolicitacao, lucroPct, inad?.forecastInadimplenciaPercent],
  );

  const alerts = useMemo(
    () =>
      extractFinanceAlerts({
        fin: bundle?.fin ?? null,
        ind: bundle?.ind ?? null,
      }),
    [bundle?.fin, bundle?.ind],
  );

  const onAsk = useCallback(
    (q: string) => {
      const r = answerCfoQuestion(q, { fin: bundle?.fin ?? null, ind: bundle?.ind ?? null, rec: bundle?.rec ?? null });
      return { text: r.reply, priority: r.priority };
    },
    [bundle?.fin, bundle?.ind, bundle?.rec],
  );

  if (!bundle) {
    return (
      <>
        <p className="text-zinc-500">Carregando copiloto financeiro…</p>
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
          <h1 className="text-3xl font-light text-white">AI Console · Financeiro / Executivo</h1>
          <p className="mt-2 max-w-xl text-sm text-zinc-500">
            CFO copilot com <code className="text-zinc-600">/dashboard-financeiro</code>, indicadores comerciais, recomendações e faturamento.
          </p>
        </div>
        <Button type="button" variant="outline" className="border-violet-500/40" onClick={() => void refresh()}>
          Sincronizar
        </Button>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-5">
          <CfoChat onAsk={onAsk} />
          <PricingAdvisor ind={indData ?? null} margemPct={margemPct} />
        </div>
        <div className="space-y-4 xl:col-span-7">
          <MarginRiskRadar axes={radar} />
          <FinancialForecastPanel
            forecastReceita={inad?.forecastFaturamentoProximoMes ?? 0}
            inadPct={inad?.forecastInadimplenciaPercent ?? 0}
            ticketMedio={finSnap?.mediaTicketPorSolicitacao ?? 0}
          />
          <ExecutiveAlerts lines={alerts} />
        </div>
      </div>
    </>
  );
}
