"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { staffJson } from "@/lib/api/staff-client";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import type { AdminContract } from "@/lib/admin/types";
import { readJson, adminContractsKey } from "@/lib/admin/storage";
import { lastNDays } from "@/lib/admin/dates";
import { computeSlaFitPct } from "@/lib/admin/contract-helpers";
import { ContractCard } from "@/components/admin/contract-card";
import { SlaGauge } from "@/components/admin/sla-gauge";
import { PenaltyMatrix, type PenaltyRow } from "@/components/admin/penalty-matrix";
import { ContractDocumentViewer } from "@/components/admin/contract-document-viewer";
import { cn } from "@/lib/utils";

type Tab = "resumo" | "sla" | "penal" | "docs";

export default function AdminContratoDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? decodeURIComponent(params.id) : "";
  const allowed = useStaffAuthStore((s) => s.user?.role === "ADMIN" || s.user?.role === "GERENTE");
  const [c, setC] = useState<AdminContract | null>(null);
  const [tab, setTab] = useState<Tab>("resumo");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [kpi, setKpi] = useState<{
    cicloH: number | null;
    throughputGate: number | null;
    dwellH: number | null;
    resumoTotal: number | null;
    expedProxyH: number | null;
    gateInRealH: number | null;
    fatValor?: number | null;
    fatQtd?: number | null;
  } | null>(null);

  const loadContract = useCallback(() => {
    const list = readJson<AdminContract[]>(adminContractsKey(), []);
    setC(list.find((x) => x.id === id) ?? null);
  }, [id]);

  useEffect(() => {
    loadContract();
  }, [loadContract]);

  useEffect(() => {
    if (!c?.clienteId) return;
    const { ini, fim } = lastNDays(30);
    void (async () => {
      try {
        const [perf, dash, resumoSol, resumoFat] = await Promise.all([
          staffJson<{
            estrategicos?: { tempoMedioDeCicloCompletoHoras?: number | null; throughputGate?: number | null };
            gargalos?: { violacoesGateSemPortaria?: number };
          }>(`/dashboard-performance?dataInicio=${ini}&dataFim=${fim}&clienteId=${c.clienteId}`),
          staffJson<{
            sla?: {
              tempoMedioPortariaGate?: number | null;
              tempoMedioGatePatio?: number | null;
              tempoMedioPatioSaida?: number | null;
              idadeMediaEstadiaHoras?: number | null;
            };
          }>(`/dashboard?dataInicio=${ini}&dataFim=${fim}&clienteId=${c.clienteId}`),
          staffJson<{ total?: number }>(`/relatorios/operacional/solicitacoes?dataInicio=${ini}&dataFim=${fim}`).catch(() => ({ total: null })),
          staffJson<{ totalValor?: unknown; quantidadeFaturamentos?: number }>(
            `/relatorios/financeiro/faturamento?dataInicio=${ini}&dataFim=${fim}&clienteId=${c.clienteId}`,
          ).catch(() => ({ totalValor: null, quantidadeFaturamentos: 0 })),
        ]);
        const ciclo = perf.estrategicos?.tempoMedioDeCicloCompletoHoras ?? null;
        const tg = perf.estrategicos?.throughputGate ?? null;
        const portGateMin = dash.sla?.tempoMedioPortariaGate ?? null;
        const dwell = dash.sla?.idadeMediaEstadiaHoras ?? null;
        const gatePatio = dash.sla?.tempoMedioGatePatio ?? null;
        const patioSaida = dash.sla?.tempoMedioPatioSaida ?? null;
        const expedProxy =
          gatePatio != null && patioSaida != null ? (gatePatio + patioSaida) / 60 : null;
        setKpi({
          cicloH: ciclo,
          throughputGate: tg,
          dwellH: dwell,
          expedProxyH: expedProxy,
          resumoTotal: resumoSol.total ?? null,
          gateInRealH: portGateMin != null ? portGateMin / 60 : null,
          fatValor: resumoFat.totalValor != null ? Number(resumoFat.totalValor) : null,
          fatQtd: resumoFat.quantidadeFaturamentos ?? null,
        });
      } catch {
        setKpi(null);
      }
    })();
  }, [c?.clienteId]);

  if (!allowed) return null;
  if (!c) {
    return (
      <div>
        <Link href="/admin/contratos" className="text-sky-400 text-sm">
          ← Voltar
        </Link>
        <p className="mt-4 text-zinc-500">Contrato não encontrado no armazenamento local.</p>
      </div>
    );
  }

  const slaPct = kpi
    ? computeSlaFitPct({
        contratualGateInH: c.sla.gateInMaxH,
        realCicloHoras: kpi.cicloH,
        realDwellH: kpi.dwellH,
        contratualDwellH: c.sla.dwellMedEsperadoH,
      })
    : 0;

  const gateInGauge = kpi?.gateInRealH != null && c.sla.gateInMaxH > 0
    ? Math.max(0, Math.min(100, 100 - ((kpi.gateInRealH - c.sla.gateInMaxH) / c.sla.gateInMaxH) * 50))
    : 72;

  const expedGauge = kpi?.expedProxyH != null
    ? Math.max(0, Math.min(100, 100 - ((kpi.expedProxyH - c.sla.expedicaoMaxH) / c.sla.expedicaoMaxH) * 40))
    : 68;

  const penaltyRows: PenaltyRow[] = [
    ...c.penalidades.map((p, i) => ({
      id: `p-${i}`,
      tipo: p.descricao,
      severidade: (p.fator >= 0.05 ? "grave" : p.fator >= 0.02 ? "moderada" : "leve") as PenaltyRow["severidade"],
      descricao: `Fator ${p.fator} × dias ${p.tipoDia} (simulação local)`,
      valorEstimado: `— (BRL)`,
    })),
    ...(kpi && kpi.cicloH != null && kpi.cicloH > c.sla.gateInMaxH * 3
      ? [
          {
            id: "breach-ciclo",
            tipo: "Ciclo total",
            severidade: "moderada" as const,
            descricao: `Ciclo ${kpi.cicloH.toFixed(1)}h acima do envelope esperado vs gate-in ${c.sla.gateInMaxH}h`,
            valorEstimado: `${(kpi.cicloH * c.commercial.armazenagem * 0.02).toFixed(0)} (proxy)`,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <Link href="/admin/contratos" className="text-sm text-sky-400 hover:underline">
        ← Contratos
      </Link>
      <div>
        <h1 className="font-serif text-3xl font-bold text-white">{c.clienteNome}</h1>
        <p className="text-sm text-zinc-500">
          Versão {c.versaoDoc} · {c.status}
        </p>
      </div>
      <div className="flex flex-wrap gap-1 border-b border-white/10">
        {(
          [
            ["resumo", "Resumo"],
            ["sla", "SLA real × contrato"],
            ["penal", "Penalidades"],
            ["docs", "Documentos"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={cn(
              "rounded-t-lg px-4 py-2 text-xs font-bold uppercase",
              tab === k ? "bg-sky-500/20 text-sky-100" : "text-zinc-500 hover:bg-white/5",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "resumo" && (
        <>
          <ContractCard title="A) Resumo contratual" subtitle="Governança">
            <p>Vigência {c.vigenciaInicio} — {c.vigenciaFim}</p>
            <p>{c.condicaoResumo}</p>
            <p className="text-xs text-zinc-500">Modelo: {c.modeloCobranca}</p>
          </ContractCard>
          <ContractCard title="KPIs reais (API)" subtitle="Dashboard & performance filtrados por cliente">
            <ul className="space-y-1 text-sm">
              <li>Ciclo completo (h): <span className="font-mono text-emerald-300">{kpi?.cicloH ?? "—"}</span></li>
              <li>Throughput gate: <span className="font-mono text-emerald-300">{kpi?.throughputGate ?? "—"}</span></li>
              <li>Dwell médio (h): <span className="font-mono text-emerald-300">{kpi?.dwellH ?? "—"}</span></li>
              <li>Solicitações (resumo período): <span className="font-mono text-sky-300">{kpi?.resumoTotal ?? "—"}</span></li>
              <li>Faturamento período (resumo): <span className="font-mono text-sky-300">{kpi?.fatValor != null ? kpi.fatValor : "—"}</span> · Qtd: {kpi?.fatQtd ?? "—"}</li>
            </ul>
          </ContractCard>
        </>
      )}

      {tab === "sla" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <SlaGauge
            value={slaPct}
            label="Aderência SLA agregada (proxy)"
            hint="Combina ciclo, dwell e metas do contrato usando somente cálculo local."
          />
          <SlaGauge value={gateInGauge} label="Gate-in vs contrato" hint="Base: tempo médio portaria→gate do dashboard." />
          <SlaGauge value={expedGauge} label="Expedição (proxy gate→saída)" hint="Deriva de tempos médios em minutos." />
        </div>
      )}

      {tab === "penal" && <PenaltyMatrix rows={penaltyRows} />}

      {tab === "docs" && (
        <ContractCard title="D) Documentos" subtitle="Upload apenas no navegador">
          <label className="cursor-pointer text-sm text-sky-400">
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const u = URL.createObjectURL(f);
                setPdfUrl((prev) => {
                  if (prev) URL.revokeObjectURL(prev);
                  return u;
                });
              }}
            />
            Anexar PDF
          </label>
          <div className="mt-4">
            <ContractDocumentViewer url={pdfUrl} title="Contrato assinado (visualização)" />
          </div>
        </ContractCard>
      )}
    </div>
  );
}
