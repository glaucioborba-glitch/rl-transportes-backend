"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { staffJson } from "@/lib/api/staff-client";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { lastNDays } from "@/lib/admin/dates";
import { readJson, adminContractsKey } from "@/lib/admin/storage";
import type { AdminContract } from "@/lib/admin/types";
import { ContractCard } from "@/components/admin/contract-card";
import { LegalRiskGauge } from "@/components/admin/legal-risk-gauge";
import { ComplianceTimeline } from "@/components/admin/compliance-timeline";
import { ViolationList, type ViolationItem } from "@/components/admin/violation-list";

export default function AdminJuridicoRiscosPage() {
  const allowed = useStaffAuthStore((s) => s.user?.role === "ADMIN" || s.user?.role === "GERENTE");
  const [violations, setViolations] = useState<ViolationItem[]>([]);
  const [auditEvents, setAuditEvents] = useState<{ id: string; at: string; label: string; tone?: "neutral" | "warn" | "crit" }[]>([]);
  const [riskNum, setRiskNum] = useState(45);

  useEffect(() => {
    const { ini, fim } = lastNDays(14);
    void (async () => {
      try {
        const [dash, perf, aud] = await Promise.all([
          staffJson<{ conflitos: { unidadesComISORepetido: number; gatesSemPortaria: number; saidasSemGateOuPatio: number; tentativas403PorEscopo: number } }>(`/dashboard?dataInicio=${ini}&dataFim=${fim}`),
          staffJson<{
            gargalos: { isoDuplicado: number; violacoesGateSemPortaria: number; violacoesSaidaSemCompleto: number };
            estrategicos: { taxaRetrabalho: number | null };
          }>(`/dashboard-performance?dataInicio=${ini}&dataFim=${fim}`),
          staffJson<{ data: { id: string; createdAt: string; tabela: string; acao: string }[] }>(`/auditoria?limit=15&order=desc`).catch(() => ({ data: [] })),
        ]);
        const v: ViolationItem[] = [];
        if (dash.conflitos.unidadesComISORepetido > 0) {
          v.push({
            id: "iso",
            titulo: "ISO duplicado ativo",
            detalhe: `${dash.conflitos.unidadesComISORepetido} ocorrências no painel operacional.`,
            severidade: "alta",
            fonte: "GET /dashboard",
          });
        }
        if (dash.conflitos.gatesSemPortaria > 0) {
          v.push({
            id: "gate",
            titulo: "Gate sem portaria",
            detalhe: `${dash.conflitos.gatesSemPortaria} registros sinalizados.`,
            severidade: "alta",
            fonte: "GET /dashboard",
          });
        }
        if (dash.conflitos.saidasSemGateOuPatio > 0) {
          v.push({
            id: "saida",
            titulo: "Saída sem gate/pátio",
            detalhe: `${dash.conflitos.saidasSemGateOuPatio} ocorrências.`,
            severidade: "media",
            fonte: "GET /dashboard",
          });
        }
        if (dash.conflitos.tentativas403PorEscopo > 0) {
          v.push({
            id: "403",
            titulo: "Tentativas fora de escopo (403)",
            detalhe: `${dash.conflitos.tentativas403PorEscopo} eventos de segurança.`,
            severidade: "alta",
            fonte: "GET /dashboard",
          });
        }
        if (perf.gargalos.isoDuplicado > 0) {
          v.push({
            id: "iso-p",
            titulo: "ISO duplicado (performance)",
            detalhe: `${perf.gargalos.isoDuplicado} (agregação performance).`,
            severidade: "media",
            fonte: "GET /dashboard-performance",
          });
        }
        if (perf.gargalos.violacoesGateSemPortaria > 0) {
          v.push({
            id: "vg",
            titulo: "Violações gate sem portaria",
            detalhe: `${perf.gargalos.violacoesGateSemPortaria}`,
            severidade: "alta",
            fonte: "GET /dashboard-performance",
          });
        }
        if (perf.gargalos.violacoesSaidaSemCompleto > 0) {
          v.push({
            id: "vs",
            titulo: "Saída incompleta",
            detalhe: `${perf.gargalos.violacoesSaidaSemCompleto}`,
            severidade: "media",
            fonte: "GET /dashboard-performance",
          });
        }
        const retr = perf.estrategicos.taxaRetrabalho ?? 0;
        if (retr > 0.15) {
          v.push({
            id: "ret",
            titulo: "Retrabalho técnico elevado",
            detalhe: `Taxa ${(retr * 100).toFixed(1)}% updates sobre eventos.`,
            severidade: retr > 0.35 ? "alta" : "baixa",
            fonte: "GET /dashboard-performance",
          });
        }
        setViolations(v);
        setAuditEvents(
          (aud.data ?? []).map((a) => ({
            id: a.id,
            at: a.createdAt,
            label: `${a.tabela} · ${a.acao}`,
            tone: a.acao.includes("DELETE") ? "crit" : "neutral",
          })),
        );
        setRiskNum(Math.min(95, v.length * 12 + Math.round(retr * 100)));
      } catch {
        setViolations([]);
      }
    })();
  }, []);

  if (!allowed) return null;

  return (
    <div className="space-y-6">
      <Link href="/admin/juridico" className="text-sm text-sky-400 hover:underline">
        ← Jurídico
      </Link>
      <div>
        <h1 className="font-serif text-3xl font-bold text-white">Riscos & conformidade</h1>
        <p className="text-sm text-zinc-500">Dados reais do backend + leitura de auditoria.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <ContractCard title="Índice composto" subtitle="Proxy local">
          <LegalRiskGauge value={riskNum} label="Exposição operacional" />
        </ContractCard>
        <ContractCard title="Violações (lista)" subtitle="Consolidado">
          <div className="max-h-[420px] overflow-y-auto pr-1">
            <ViolationList items={violations} />
          </div>
        </ContractCard>
        <ContractCard title="Linha do tempo — auditoria" subtitle="GET /auditoria">
          <div className="max-h-[420px] overflow-y-auto">
            {auditEvents.length === 0 ? <p className="text-sm text-zinc-500">Sem eventos.</p> : <ComplianceTimeline events={auditEvents} />}
          </div>
        </ContractCard>
      </div>
      <ContractCard title="Análise de adequação contratual (front)" subtitle="Recomendações heurísticas">
        <AdequacaoPanel />
      </ContractCard>
    </div>
  );
}

function AdequacaoPanel() {
  const [text, setText] = useState<string>("Carregando…");
  useEffect(() => {
    const contracts = readJson<AdminContract[]>(adminContractsKey(), []);
    const { ini, fim } = lastNDays(30);
    void staffJson<{
      estrategicos: { tempoMedioDeCicloCompletoHoras?: number | null; taxaRetrabalho?: number | null };
    }>(`/dashboard-performance?dataInicio=${ini}&dataFim=${fim}`)
      .then((p) => {
        const ciclo = p.estrategicos.tempoMedioDeCicloCompletoHoras ?? 0;
        const retr = p.estrategicos.taxaRetrabalho ?? 0;
        const recs: string[] = [];
        for (const c of contracts) {
          if (ciclo > c.sla.gateInMaxH * 2)
            recs.push(`${c.clienteNome}: ciclo real acima do envelope — considerar renegociar SLA ou reprecificar armazenagem.`);
          if (retr > 0.25) recs.push(`${c.clienteNome}: retrabalho elevado — revisão contratual de multas e trilha operacional.`);
        }
        if (!recs.length) setText("Sem divergências fortes detectadas entre proxies globais e cláusulas salvas localmente.");
        else setText(recs.join("\n"));
      })
      .catch(() => setText("Não foi possível carregar performance para cruzamento."));
  }, []);
  return <p className="whitespace-pre-line text-sm text-zinc-300">{text}</p>;
}
