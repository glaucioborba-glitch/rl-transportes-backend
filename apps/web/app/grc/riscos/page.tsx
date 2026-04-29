"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GrcWorkspace } from "@/components/grc/grc-workspace";
import { GrcSection } from "@/components/grc/grc-section";
import { RiskRegisterTable } from "@/components/grc/risk-register-table";
import { Iso31000RiskMatrix } from "@/components/grc/iso31000-risk-matrix";
import { OperationalRiskFlow } from "@/components/grc/operational-risk-flow";
import { FinancialRiskPanel } from "@/components/grc/financial-risk-panel";
import { RiskTreatmentBoard } from "@/components/grc/risk-treatment-board";
import { Button } from "@/components/ui/button";
import { ApiError, staffJson } from "@/lib/api/staff-client";
import { toast } from "@/lib/toast";
import {
  deriveRiskPlots,
  mergeRiskPlots,
  plotsFromComercialRecomendacoes,
  plotsFromRegister,
  top5ReceitaPercent,
} from "@/lib/grc/derive-risks";
import { grcRiskRegister } from "@/lib/grc/storage";
import type { MatrixPlotPoint } from "@/lib/grc/types";

export default function GrcRiscosPage() {
  const [dash, setDash] = useState<Record<string, unknown> | null>(null);
  const [perf, setPerf] = useState<Record<string, unknown> | null>(null);
  const [fat, setFat] = useState<Record<string, unknown> | null>(null);
  const [sol, setSol] = useState<Record<string, unknown> | null>(null);
  const [comRec, setComRec] = useState<Record<string, unknown> | null>(null);
  const [regTick, setRegTick] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 90);
    const di = start.toISOString().slice(0, 10);
    const df = end.toISOString().slice(0, 10);
    setLoading(true);
    try {
      const [d, p, f, so, c] = await Promise.all([
        staffJson<Record<string, unknown>>(`/dashboard?dataInicio=${di}&dataFim=${df}`),
        staffJson<Record<string, unknown>>(`/dashboard-performance?dataInicio=${di}&dataFim=${df}`),
        staffJson<unknown>(`/relatorios/financeiro/faturamento?dataInicio=${di}&dataFim=${df}`).catch(() => null),
        staffJson<unknown>(`/relatorios/operacional/solicitacoes?dataInicio=${di}&dataFim=${df}`).catch(() => null),
        staffJson<unknown>(`/comercial/recomendacoes?dataInicio=${di}&dataFim=${df}`).catch(() => null),
      ]);
      setDash(d);
      setPerf(p);
      setFat(typeof f === "object" && f !== null ? (f as Record<string, unknown>) : null);
      setSol(typeof so === "object" && so !== null ? (so as Record<string, unknown>) : null);
      setComRec(typeof c === "object" && c !== null ? (c as Record<string, unknown>) : null);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha ao carregar riscos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const conflitos = dash?.conflitos as Record<string, number> | undefined;
  const gar = perf?.gargalos as
    | { violacoesGateSemPortaria?: number; violacoesSaidaSemCompleto?: number; isoDuplicado?: number }
    | undefined;
  const estr = perf?.estrategicos as {
    ocupacaoPatioPercent?: number | null;
    taxaGargaloDetectado?: boolean;
    taxaRetrabalho?: number | null;
  } | undefined;

  const matrixPlots: MatrixPlotPoint[] = useMemo(() => {
    const recs = (comRec?.recomendacoes as unknown[]) ?? [];
    const top5 = top5ReceitaPercent(fat);
    const fromDash = deriveRiskPlots({
      conflitos,
      ocupacaoPatio: estr?.ocupacaoPatioPercent ?? null,
      taxaGargalo: Boolean(estr?.taxaGargaloDetectado),
      retrabalho: estr?.taxaRetrabalho ?? null,
      top5ReceitaPct: top5,
    });
    return mergeRiskPlots(plotsFromRegister(grcRiskRegister()), fromDash, plotsFromComercialRecomendacoes(recs));
    // regTick: força releitura do registro em localStorage após edições na tabela
    // eslint-disable-next-line react-hooks/exhaustive-deps -- regTick
  }, [conflitos, estr, fat, comRec, regTick]);

  return (
    <GrcWorkspace>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Gestão de riscos — ISO 31000</h1>
          <p className="mt-1 max-w-3xl text-sm text-zinc-500">
            Registro e matriz 5×5 com sinais de <code className="text-zinc-600">/dashboard</code>, <code className="text-zinc-600">/dashboard-performance</code>,{" "}
            <code className="text-zinc-600">/relatorios/financeiro/faturamento</code> e <code className="text-zinc-600">/comercial/recomendacoes</code>. Planos 4Ts e
            registros permanecem no navegador.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" className="border-red-900/50 text-red-200/90" onClick={() => void load()} disabled={loading}>
          {loading ? "Atualizando…" : "Recarregar APIs"}
        </Button>
      </div>

      {sol ? (
        <p className="mb-4 rounded-lg border border-white/5 bg-zinc-950/40 px-3 py-2 text-[11px] text-zinc-500">
          Volume operacional (período · <code className="text-zinc-600">GET /relatorios/operacional/solicitacoes</code>):{" "}
          <span className="font-mono text-zinc-300">{String(sol.total ?? "—")}</span> solicitações.
        </p>
      ) : null}

      <div className="space-y-8">
        <GrcSection
          id="registro"
          title="1. Registro de riscos"
          subtitle="Cadastro local · nível = impacto × probabilidade (1–25) com cores de calor"
        >
          <RiskRegisterTable onRegisterChange={() => setRegTick((t) => t + 1)} />
        </GrcSection>
        <GrcSection id="matriz" title="2. Matriz de riscos 5×5 (ISO 31000)" subtitle="Probabilidade × impacto · pontos API (âmbar) e local (ciano)">
          <Iso31000RiskMatrix plots={matrixPlots} />
        </GrcSection>
        <GrcSection id="corredor" title="3. Corredor de riscos operacionais" subtitle="Fluxo portaria → gate → pátio → saída">
          <OperationalRiskFlow
            gatesSemPortaria={gar?.violacoesGateSemPortaria ?? conflitos?.gatesSemPortaria ?? 0}
            isoDup={gar?.isoDuplicado ?? conflitos?.unidadesComISORepetido ?? 0}
            taxaGargalo={Boolean(estr?.taxaGargaloDetectado)}
            ocupacaoPatio={estr?.ocupacaoPatioPercent ?? null}
            saidaIncompleta={gar?.violacoesSaidaSemCompleto ?? 0}
          />
        </GrcSection>
        <GrcSection id="financeiro" title="4. Risco financeiro &amp; concentração" subtitle="Crédito, liquidez e margem a partir de faturamento e recomendações comerciais">
          <FinancialRiskPanel faturamentoResumo={fat} comercialRecomendacoes={comRec} />
        </GrcSection>
        <GrcSection id="comercial" title="5. Risco comercial (sinais automáticos)" subtitle="Alertas da rota /comercial/recomendacoes no período">
          <ComercialSignals rec={comRec} />
        </GrcSection>
        <GrcSection id="tratamento" title="6. Tratamento do risco — 4Ts" subtitle="Tolerar · Tratar · Transferir · Terminar · plano resumido (local)">
          <RiskTreatmentBoard />
        </GrcSection>
      </div>
    </GrcWorkspace>
  );
}

function ComercialSignals({ rec }: { rec: Record<string, unknown> | null }) {
  const rows = (rec?.recomendacoes as Record<string, unknown>[] | undefined) ?? [];
  if (!rows.length) {
    return <p className="text-sm text-zinc-600">Sem recomendações no período ou rota indisponível.</p>;
  }
  return (
    <ul className="max-h-64 space-y-2 overflow-auto text-[11px]">
      {rows.slice(0, 20).map((r, i) => (
        <li key={i} className="rounded-lg border border-red-900/25 bg-red-950/10 px-3 py-2">
          <span className="font-semibold text-rose-200/90">{String(r.titulo ?? "")}</span>
          <p className="text-zinc-500">{String(r.descricao ?? "")}</p>
          <p className="mt-1 text-[10px] uppercase text-zinc-600">
            {(r.prioridade as string) ?? "—"} · {(r.tipo as string) ?? "—"}
          </p>
        </li>
      ))}
    </ul>
  );
}
