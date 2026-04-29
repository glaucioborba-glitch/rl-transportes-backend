"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { DisciplineIndexPanel } from "@/components/aog/discipline-index-panel";
import { AuditAutoScanner } from "@/components/aog/audit-auto-scanner";
import { HumanOpsMatrix } from "@/components/aog/human-ops-matrix";
import { BehaviorHeuristicEngine } from "@/components/aog/behavior-heuristic-engine";
import { GovernanceRulesetBoard } from "@/components/aog/governance-ruleset-board";
import { useAogDisciplina } from "@/lib/aog/use-aog-disciplina";
import {
  computeDOI,
  classifyAuditEvents,
  behaviorHeuristics,
  triageProcessPersonTime,
} from "@/lib/aog/disciplina-logic";
import { cn } from "@/lib/utils";

const TRIAD_LABEL: Record<string, string> = {
  humano: "Humano",
  processo: "Processo",
  saturacao: "Saturação",
  sistemico: "Sistêmico",
};

export default function AogDisciplinaPage() {
  const { bundle, auditRows, refresh } = useAogDisciplina();

  const perf = bundle?.perf;
  const estr = perf?.estrategicos as {
    ocupacaoPatioPercent?: number | null;
    taxaRetrabalho?: number | null;
  } | undefined;
  const satPct = Number(estr?.ocupacaoPatioPercent ?? 0) || 0;
  const retrabalho = Number(estr?.taxaRetrabalho ?? 0) || 0;

  const doi = useMemo(() => computeDOI(auditRows, bundle?.usersCount ?? null), [auditRows, bundle?.usersCount]);
  const classified = useMemo(() => classifyAuditEvents(auditRows), [auditRows]);
  const flags = useMemo(() => behaviorHeuristics(auditRows), [auditRows]);
  const triage = useMemo(() => {
    const auditVarianceHigh = doi.factors.some((f) => f.toLowerCase().includes("dispersão"));
    return triageProcessPersonTime({ satPct, retrabalho, doi: doi.score, auditVarianceHigh });
  }, [satPct, retrabalho, doi.score, doi.factors]);

  const updated = bundle?.updatedAt ? new Date(bundle.updatedAt).toLocaleString("pt-BR") : "—";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">AOG · Disciplina operacional</h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-500">
            Pessoas × processo × auditoria. Leitura: <code className="text-zinc-600">/auditoria</code>,{" "}
            <code className="text-zinc-600">/users</code>, <code className="text-zinc-600">/dashboard-performance</code>,{" "}
            <code className="text-zinc-600">/relatorios/operacional/solicitacoes</code>.
          </p>
          <p className="mt-3 text-[10px] text-zinc-600">
            Atualizado: {updated}
            {bundle?.error ? <span className="ml-2 text-red-400/90">{bundle.error}</span> : null}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" className="border-slate-500/50 text-zinc-200" onClick={() => void refresh()}>
          Recarregar
        </Button>
      </div>

      <div
        className={cn(
          "rounded-xl border px-4 py-3 text-xs",
          triage.primary === "humano"
            ? "border-amber-500/40 bg-amber-950/20 text-amber-100/90"
            : triage.primary === "saturacao"
              ? "border-orange-500/40 bg-orange-950/20 text-orange-100/90"
              : triage.primary === "processo"
                ? "border-blue-500/40 bg-blue-950/20 text-blue-100/90"
                : "border-violet-500/40 bg-violet-950/20 text-violet-100/90",
        )}
      >
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Cruzamento processo × pessoa × tempo</p>
        <p className="mt-1 font-medium text-white">
          Diagnóstico primário: <span className="font-mono">{TRIAD_LABEL[triage.primary] ?? triage.primary}</span>
        </p>
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-zinc-400">
          {triage.lines.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      </div>

      <DisciplineIndexPanel score={doi.score} factors={doi.factors} />

      <div className="grid gap-5 xl:grid-cols-2">
        <AuditAutoScanner items={classified} />
        <HumanOpsMatrix rows={auditRows} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <BehaviorHeuristicEngine flags={flags} />
        <GovernanceRulesetBoard />
      </div>
    </div>
  );
}
