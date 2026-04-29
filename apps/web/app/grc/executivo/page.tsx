"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GrcWorkspace } from "@/components/grc/grc-workspace";
import { GrcSection } from "@/components/grc/grc-section";
import { ComplianceExecutiveTiles } from "@/components/grc/executive/compliance-executive-tiles";
import { LgpdRiskDashboard } from "@/components/grc/executive/lgpd-risk-dashboard";
import { BcpImpactSimulator } from "@/components/grc/executive/bcp-impact-simulator";
import { ComplianceAnalyticsBoard } from "@/components/grc/executive/compliance-analytics-board";
import { ReputationScoreCard } from "@/components/grc/executive/reputation-score-card";
import { ApiError, staffJson, staffTryJson } from "@/lib/api/staff-client";
import { toast } from "@/lib/toast";
import {
  computeReputationScore,
  countApiRecords,
  integrityOperationalScore,
  iso31000MaturityPct,
  pctControlesEfetivos,
  pctRiscosModeradosOuCriticos,
  rankClientsByStress,
} from "@/lib/grc/executive-kpis";
import { grcRiskRegister, grcStorageControls, grcTreatments } from "@/lib/grc/storage";
import { ssmaStorage } from "@/lib/ssma/storage";
import { Button } from "@/components/ui/button";

export default function GrcExecutivoPage() {
  const [dash, setDash] = useState<Record<string, unknown> | null>(null);
  const [perf, setPerf] = useState<Record<string, unknown> | null>(null);
  const [comRec, setComRec] = useState<Record<string, unknown> | null>(null);
  const [nUsers, setNUsers] = useState<number | null>(null);
  const [nClientes, setNClientes] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 60);
    const di = start.toISOString().slice(0, 10);
    const df = end.toISOString().slice(0, 10);
    setLoading(true);
    try {
      const [d, p, c, u, cl] = await Promise.all([
        staffJson<Record<string, unknown>>(`/dashboard?dataInicio=${di}&dataFim=${df}`),
        staffJson<Record<string, unknown>>(`/dashboard-performance?dataInicio=${di}&dataFim=${df}`),
        staffTryJson<Record<string, unknown>>(`/comercial/recomendacoes?dataInicio=${di}&dataFim=${df}`),
        staffTryJson<unknown>(`/users`),
        staffTryJson<unknown>(`/clientes`),
      ]);
      setDash(d);
      setPerf(p);
      setComRec(c);
      setNUsers(countApiRecords(u));
      setNClientes(countApiRecords(cl));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha painel GRC executivo");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const derived = useMemo(() => {
    const controls = grcStorageControls();
    const risks = grcRiskRegister();
    const treatments = grcTreatments();
    const incidents = ssmaStorage.incidents.list();
    const critInc = incidents.filter((i) => i.tipo === "critico" || i.riscoPercebido === "alto").length;

    const prob = (dash?.snapshot as { unidadesComProblemas?: Record<string, unknown> } | undefined)?.unidadesComProblemas;
    const conflitos = dash?.conflitos as Record<string, number> | undefined;
    const sla = dash?.sla as
      | {
          unidadesComEstadiaCritica?: number;
          rankingClientesPorVolume?: { clienteId: string; clienteNome: string; solicitacoesNoPeriodo: number }[];
        }
      | undefined;
    const estr = perf?.estrategicos as {
      ocupacaoPatioPercent?: number | null;
      taxaGargaloDetectado?: boolean;
    } | undefined;

    const violacoes = {
      isoDuplicado: Number(prob?.isoDuplicadoEmSolicitacoesAtivas ?? 0),
      gatesSemPortaria: Math.max(Number(prob?.gatesSemPortaria ?? 0), Number(conflitos?.gatesSemPortaria ?? 0)),
      saidasSemGateOuPatio: Math.max(Number(prob?.saidasSemGateOuPatio ?? 0), Number(conflitos?.saidasSemGateOuPatio ?? 0)),
      tentativas403PorEscopo: Number(conflitos?.tentativas403PorEscopo ?? 0),
      statusInconsistentes: Number(prob?.statusInconsistentes ?? 0),
    };

    const integrity = integrityOperationalScore({
      gatesSemPortaria: violacoes.gatesSemPortaria,
      saidasSemGateOuPatio: violacoes.saidasSemGateOuPatio,
      isoDuplicado: violacoes.isoDuplicado,
      tentativas403: violacoes.tentativas403PorEscopo,
      statusInconsistentes: violacoes.statusInconsistentes,
      estadiaCritica: Number(sla?.unidadesComEstadiaCritica ?? 0),
      ocupacaoPatioPct: estr?.ocupacaoPatioPercent ?? null,
      taxaGargalo: Boolean(estr?.taxaGargaloDetectado),
    });

    const filas = dash?.filas as
      | {
          filaPortaria?: unknown[];
          filaGate?: unknown[];
          filaPatio?: unknown[];
          filaSaida?: unknown[];
          operacoesAtivasPorOperador?: unknown[];
        }
      | undefined;
    const filasTotais =
      (filas?.filaPortaria?.length ?? 0) +
      (filas?.filaGate?.length ?? 0) +
      (filas?.filaPatio?.length ?? 0) +
      (filas?.filaSaida?.length ?? 0);
    const operadoresAtivos = filas?.operacoesAtivasPorOperador?.length ?? 0;

    const recs = (comRec?.recomendacoes as Record<string, unknown>[] | undefined) ?? [];
    const recsAlta = recs.filter((r) => r.prioridade === "alta").length;
    const inadSignals = recs.filter(
      (r) =>
        String(r.titulo ?? "")
          .toLowerCase()
          .match(/boleto|inadimpl/) || String(r.descricao ?? "").toLowerCase().match(/boleto|inadimpl/),
    ).length;
    const margRuim = recs.filter((r) => String(r.titulo ?? "").toLowerCase().includes("margem comprimida")).length;

    const rep = computeReputationScore({
      integrityScore: integrity,
      pctRiscoElevado: pctRiscosModeradosOuCriticos(risks),
      recsAltaPrioridade: recsAlta,
      estadiaCritica: Number(sla?.unidadesComEstadiaCritica ?? 0),
      inadSignals,
      margemRuimSignals: margRuim,
    });

    const ranking = rankClientsByStress(comRec, sla?.rankingClientesPorVolume);

    return {
      pctCtrl: pctControlesEfetivos(controls),
      pctRisk: pctRiscosModeradosOuCriticos(risks),
      critInc,
      matur: iso31000MaturityPct(risks, treatments.length),
      integrity,
      violacoes,
      ranking,
      rep,
      operadoresAtivos,
      filasTotais,
      ocupacao: estr?.ocupacaoPatioPercent ?? null,
      taxaGar: Boolean(estr?.taxaGargaloDetectado),
    };
  }, [dash, perf, comRec]);

  return (
    <GrcWorkspace>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-zinc-500">Painel C-level</p>
          <h1 className="text-3xl font-light tracking-tight text-white">GRC Executivo</h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-500">
            Conformidade, integridade, LGPD, continuidade e reputação — leitura das APIs existentes + heurísticas e cadastros locais (COSO / ISO 31000 / SSMA).
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" className="border-indigo-500/40" disabled={loading} onClick={() => void load()}>
          {loading ? "Atualizando…" : "Sincronizar dados"}
        </Button>
      </div>

      <div className="space-y-10">
        <GrcSection title="1. Conformidade corporativa" subtitle="KPIs consolidados · cores semânticas para decisão rápida">
          <ComplianceExecutiveTiles
            pctControlesEfetivos={derived.pctCtrl}
            pctRiscosModeradosCriticos={derived.pctRisk}
            incidentesCriticos={derived.critInc}
            maturidadeIso31000={derived.matur}
            integrityScore={derived.integrity}
          />
        </GrcSection>

        <GrcSection title="2. LGPD" subtitle="Inventário, mapa de riscos e checklist ANPD (armazenamento local)">
          <LgpdRiskDashboard countColaboradores={nUsers} countClientes={nClientes} countMotoristas={null} />
        </GrcSection>

        <GrcSection
          title="3. Continuidade de negócio (BCP)"
          subtitle="Ausência de operadores, saturação e quedas críticas — simulação de choque de capacidade"
        >
          <BcpImpactSimulator
            operadoresAtivos={derived.operadoresAtivos || 6}
            ocupacaoPatioPct={derived.ocupacao}
            taxaGargalo={derived.taxaGar}
            filasTotais={derived.filasTotais}
          />
        </GrcSection>

        <GrcSection title="4. Compliance analytics" subtitle="Violações reais do dashboard e ranking de clientes sob tensão">
          <ComplianceAnalyticsBoard integrityScore={derived.integrity} violacoes={derived.violacoes} ranking={derived.ranking} />
        </GrcSection>

        <GrcSection title="5. Risco reputacional &amp; estratégico" subtitle="Score e respostas sugeridas (sem persistência de backend)">
          <ReputationScoreCard rep={derived.rep} />
        </GrcSection>
      </div>
    </GrcWorkspace>
  );
}
