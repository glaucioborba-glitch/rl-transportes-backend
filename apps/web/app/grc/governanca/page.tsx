"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GrcWorkspace } from "@/components/grc/grc-workspace";
import { GrcSection } from "@/components/grc/grc-section";
import { CosoPillarsBoard } from "@/components/grc/coso-pillars-board";
import { InternalControlsMatrix } from "@/components/grc/internal-controls-matrix";
import { ControlEffectivenessChecklist } from "@/components/grc/control-effectiveness-checklist";
import { GovernanceOrgChart } from "@/components/grc/governance-org-chart";
import { AuditTrailTable } from "@/components/grc/audit-trail-table";
import { Button } from "@/components/ui/button";
import { ApiError, staffJson } from "@/lib/api/staff-client";
import { toast } from "@/lib/toast";
import { mergeAuditoriaPayloads } from "@/lib/grc/auditoria-map";
import type { AuditRow } from "@/components/ssma/audit-security-table";
import { cn } from "@/lib/utils";

export default function GrcGovernancaPage() {
  const [audRows, setAudRows] = useState<AuditRow[]>([]);
  const [dash, setDash] = useState<Record<string, unknown> | null>(null);
  const [perf, setPerf] = useState<Record<string, unknown> | null>(null);
  const [sol, setSol] = useState<Record<string, unknown> | null>(null);
  const [fat, setFat] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    const di = start.toISOString().slice(0, 10);
    const df = end.toISOString().slice(0, 10);
    setLoading(true);
    try {
      const [d, p, s, f, a0, a1, a2] = await Promise.all([
        staffJson<Record<string, unknown>>(`/dashboard?dataInicio=${di}&dataFim=${df}`),
        staffJson<Record<string, unknown>>(`/dashboard-performance?dataInicio=${di}&dataFim=${df}`),
        staffJson<unknown>(`/relatorios/operacional/solicitacoes?dataInicio=${di}&dataFim=${df}`).catch(() => null),
        staffJson<unknown>(`/relatorios/financeiro/faturamento?dataInicio=${di}&dataFim=${df}`).catch(() => null),
        staffJson<unknown>(`/auditoria?limit=100&order=desc`).catch(() => ({ data: [] })),
        staffJson<unknown>(`/auditoria?tabela=solicitacoes&limit=60&order=desc`).catch(() => ({ data: [] })),
        staffJson<unknown>(`/auditoria?tabela=users&limit=40&order=desc`).catch(() => ({ data: [] })),
      ]);
      setDash(d);
      setPerf(p);
      setSol(typeof s === "object" && s !== null ? (s as Record<string, unknown>) : null);
      setFat(typeof f === "object" && f !== null ? (f as Record<string, unknown>) : null);
      setAudRows(mergeAuditoriaPayloads(a0, a1, a2));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha ao carregar governança");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const conflitos = dash?.conflitos as Record<string, number> | undefined;
  const conflitosSum =
    (conflitos?.gatesSemPortaria ?? 0) +
    (conflitos?.saidasSemGateOuPatio ?? 0) +
    (conflitos?.unidadesComISORepetido ?? 0) +
    (conflitos?.tentativas403PorEscopo ?? 0);
  const estr = perf?.estrategicos as { taxaGargaloDetectado?: boolean; ocupacaoPatioPercent?: number | null } | undefined;
  const updateDelete = useMemo(() => audRows.filter((r) => /UPDATE|DELETE/i.test(r.acao)), [audRows]);

  return (
    <GrcWorkspace>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Governança COSO</h1>
          <p className="mt-1 max-w-3xl text-sm text-zinc-500">
            Estrutura de controles internos (ICIF) e linha COSO ERM — leitura de{" "}
            <code className="text-zinc-600">/dashboard</code>, <code className="text-zinc-600">/dashboard-performance</code>, relatórios e{" "}
            <code className="text-zinc-600">/auditoria</code>. Metadados de matriz e checklist permanecem no navegador.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" className="border-indigo-500/40" onClick={() => void load()} disabled={loading}>
          {loading ? "Atualizando…" : "Recarregar dados"}
        </Button>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi title="Indicadores de conflito" value={`${conflitosSum}`} hint="Soma gates sem portaria, saídas incompletas, ISO duplicado e 403." warn={conflitosSum > 0} />
        <Kpi
          title="Fora de escopo / 403"
          value={`${conflitos?.tentativas403PorEscopo ?? 0}`}
          hint="SEGURANCA · escopo_cliente."
          warn={(conflitos?.tentativas403PorEscopo ?? 0) > 0}
        />
        <Kpi
          title="Ocupação pátio"
          value={estr?.ocupacaoPatioPercent != null ? `${Math.round(estr.ocupacaoPatioPercent)}%` : "—"}
          hint="Performance vs capacidade estimada."
          warn={(estr?.ocupacaoPatioPercent ?? 0) >= 70}
        />
        <Kpi
          title="Trilha (UPDATE/DELETE)"
          value={`${updateDelete.length}`}
          hint={`Amostras mescladas · ${audRows.length} eventos.`}
          warn={updateDelete.length > 25}
        />
      </div>

      {(sol || fat) && (
        <p className="mb-4 rounded-lg border border-white/5 bg-zinc-950/40 px-3 py-2 text-[11px] text-zinc-500">
          Contexto: solicitações no período <span className="font-mono text-zinc-400">{String((sol as { total?: number } | null)?.total ?? "—")}</span> · faturamento
          agregado{" "}
          <span className="font-mono text-zinc-400">
            {fat ? `${String(fat.quantidadeFaturamentos ?? 0)} lançamentos` : "—"}
          </span>
          .
        </p>
      )}

      <div className="space-y-8">
        <GrcSection id="coso" title="1. Modelo COSO — cinco componentes" subtitle="COSO Internal Control — Integrated Framework (referência) e ERM 2023">
          <CosoPillarsBoard />
        </GrcSection>
        <GrcSection
          id="matriz"
          title="2. Matriz de controles internos"
          subtitle="Visão tipo SOX light · processos críticos × evidência e dono · status de eficácia persistido localmente"
        >
          <InternalControlsMatrix />
        </GrcSection>
        <GrcSection id="teste" title="3. Teste de efetividade (design, execução, evidências)" subtitle="Checklist por controle · aprovado / reprovado / revisão">
          <ControlEffectivenessChecklist />
        </GrcSection>
        <GrcSection id="org" title="4. Organograma de governança" subtitle="Diretoria → Comitê de Auditoria → Gerência → donos de controle">
          <GovernanceOrgChart />
        </GrcSection>
        <GrcSection
          id="auditoria"
          title="5. Auditoria interna — trilha"
          subtitle="Eventos sensíveis, alterações em dados críticos e consultas à trilha (GET /auditoria). Visão do auditor."
        >
          <AuditTrailTable rows={audRows} />
        </GrcSection>
      </div>
    </GrcWorkspace>
  );
}

function Kpi({ title, value, hint, warn }: { title: string; value: string; hint: string; warn: boolean }) {
  return (
    <div className={cn("rounded-xl border px-4 py-3", warn ? "border-amber-500/35 bg-amber-950/15" : "border-white/10 bg-zinc-950/40")}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{title}</p>
      <p className="mt-1 font-mono text-xl text-white">{value}</p>
      <p className="mt-1 text-[10px] text-zinc-600">{hint}</p>
    </div>
  );
}
