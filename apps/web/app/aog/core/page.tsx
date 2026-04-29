"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { GovernanceWatchdog } from "@/components/aog/governance-watchdog";
import { ConformityEngine } from "@/components/aog/conformity-engine";
import { CrossRiskMatrix } from "@/components/aog/cross-risk-matrix";
import { AnomalyDetector } from "@/components/aog/anomaly-detector";
import { CompliancePlaybook } from "@/components/aog/compliance-playbook";
import { useAogCore } from "@/lib/aog/use-aog-core";
import {
  classifyWatchdog,
  runConformityEngine,
  buildCrossRiskMatrix,
  detectGovernanceAnomalies,
} from "@/lib/aog/core-logic";
import { maxGargaloProb } from "@/lib/ai-console/operational-snapshot";
import { cn } from "@/lib/utils";

function throughputBalanced(tpP: number, tpG: number): boolean {
  if (tpP <= 0 && tpG <= 0) return true;
  const m = Math.max(tpP, tpG, 1e-6);
  return Math.abs(tpP - tpG) / m < 0.45;
}

export default function AogCorePage() {
  const { bundle, snap, auditRows, refresh } = useAogCore();

  const dash = bundle?.dash;
  const fin = bundle?.fin;
  const rel = bundle?.rel;
  const conflitos = dash?.conflitos as Record<string, number> | undefined;
  const t403 = conflitos?.tentativas403PorEscopo ?? 0;
  const conflitosSum =
    (conflitos?.gatesSemPortaria ?? 0) +
    (conflitos?.saidasSemGateOuPatio ?? 0) +
    (conflitos?.unidadesComISORepetido ?? 0) +
    t403;

  const derived = useMemo(() => {
    if (!snap) return null;
    const inadRaw = (fin?.inadimplencia as { taxaInadimplenciaGeralPercent?: number | null } | undefined)
      ?.taxaInadimplenciaGeralPercent;
    const inadN = typeof inadRaw === "number" && Number.isFinite(inadRaw) ? inadRaw : 0;
    const relTotal = Number((rel as { total?: number } | null)?.total ?? 0);
    const actorN = new Set(auditRows.map((r) => r.usuario).filter(Boolean)).size;

    const operacional = Math.min(100, Math.round(snap.sat * 0.6 + snap.vb * 12 + (snap.taxaGargalo ? 15 : 0)));
    const financeiro = Math.min(100, Math.round(inadN * 2.5 + (inadN > 8 ? 22 : 0)));
    const comercial = Math.min(100, Math.round(28 + (relTotal > 500 ? 28 : relTotal > 200 ? 18 : 8)));
    const humano = Math.min(100, Math.round(22 + actorN * 3.5 + (auditRows.length > 120 ? 18 : 0)));
    const ssma = Math.min(100, Math.round(snap.vb * 16 + (snap.estadiaCrit > 1 ? 22 : snap.estadiaCrit > 0 ? 12 : 0)));
    const reputacional = Math.min(100, Math.round(t403 * 9 + conflitosSum * 2.5));

    const watchdog = classifyWatchdog({
      violacoes: snap.vb,
      satPct: snap.sat,
      retrabalho: snap.retr,
      estadiaCritica: snap.estadiaCrit,
      t403,
      taxaGargalo: snap.taxaGargalo,
      auditRows,
    });
    const conformity = runConformityEngine({
      estadiaCritica: snap.estadiaCrit,
      satPct: snap.sat,
      taxaGargalo: snap.taxaGargalo,
      retrabalho: snap.retr,
      violacoes: snap.vb,
      throughputBalanced: throughputBalanced(snap.tpPortaria, snap.tpGate),
    });
    const cross = buildCrossRiskMatrix({
      operacional,
      financeiro,
      comercial,
      humano,
      ssma,
      reputacional,
    });
    const anomalies = detectGovernanceAnomalies({
      auditRows,
      tpPortaria: snap.tpPortaria,
      tpGate: snap.tpGate,
      satPct: snap.sat,
    });
    return { watchdog, conformity, cross, anomalies };
  }, [snap, fin, rel, auditRows, t403, conflitosSum]);

  const iaProb = maxGargaloProb(bundle?.gar ?? null);
  const updated = bundle?.updatedAt ? new Date(bundle.updatedAt).toLocaleString("pt-BR") : "—";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">AOG · Governance core</h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-500">
            Supervisão contínua, conformidade e matriz de risco cruzado. Leitura:{" "}
            <code className="text-zinc-600">/dashboard</code>, <code className="text-zinc-600">/dashboard-performance</code>,{" "}
            <code className="text-zinc-600">/auditoria</code>, <code className="text-zinc-600">/relatorios/operacional/solicitacoes</code>,{" "}
            <code className="text-zinc-600">/dashboard-financeiro</code>, sondas <code className="text-zinc-600">/ia-operacional/previsoes</code> e{" "}
            <code className="text-zinc-600">/ia/gargalos</code>.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-zinc-600">
            <span>
              IA prévia:{" "}
              <span className={cn("font-mono", bundle?.prevNote ? "text-emerald-400" : "text-zinc-500")}>
                {bundle?.prevNote ? "endpoint respondeu" : "sem sinal / indisponível"}
              </span>
            </span>
            <span>·</span>
            <span>
              Pico gargalo (proxy): <span className="font-mono text-zinc-400">{(iaProb * 100).toFixed(0)}%</span>
            </span>
            <span>·</span>
            <span>Atualizado: {updated}</span>
            {bundle?.error ? (
              <>
                <span>·</span>
                <span className="text-red-400/90">{bundle.error}</span>
              </>
            ) : null}
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" className="border-slate-500/50 text-zinc-200" onClick={() => void refresh()}>
          Recarregar
        </Button>
      </div>

      {!snap || !derived ? (
        <p className="rounded-xl border border-white/10 bg-black/40 px-4 py-8 text-center text-sm text-zinc-500">
          Carregando snapshot operacional…
        </p>
      ) : (
        <>
          <GovernanceWatchdog level={derived.watchdog.level} signals={derived.watchdog.signals} />
          <div className="grid gap-5 xl:grid-cols-2">
            <ConformityEngine overall={derived.conformity.overall} checks={derived.conformity.checks} />
            <CrossRiskMatrix dimensions={derived.cross.dimensions} grcIndex={derived.cross.grcIndex} />
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <AnomalyDetector items={derived.anomalies} />
            <CompliancePlaybook />
          </div>
        </>
      )}
    </div>
  );
}
