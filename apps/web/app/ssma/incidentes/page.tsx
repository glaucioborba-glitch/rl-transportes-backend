"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SsmaWorkspace } from "@/components/ssma/ssma-workspace";
import { SsmaSection } from "@/components/ssma/ssma-section";
import { IncidentForm } from "@/components/ssma/incident-form";
import { RiskMatrix } from "@/components/ssma/risk-matrix";
import { IshikawaDiagram } from "@/components/ssma/ishikawa-diagram";
import { PatioRiskMap } from "@/components/ssma/patio-risk-map";
import { SsmaHeatLevels } from "@/components/ssma/ssma-heat-levels";
import { Button } from "@/components/ui/button";
import { ApiError, staffJson } from "@/lib/api/staff-client";
import { toast } from "@/lib/toast";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { buildTerminalRiskCatalog } from "@/lib/ssma/risk-catalog";
import { ssmaStorage } from "@/lib/ssma/storage";
import type { Investigation5w2h, IshikawaBranches, TimelineStep } from "@/lib/ssma/types";

const TOC = [
  { id: "registro", label: "Registro" },
  { id: "investigacao", label: "Investigação" },
  { id: "catalogo", label: "Catálogo" },
  { id: "mapa", label: "Mapa pátio" },
];

export default function SsmaIncidentesPage() {
  const allowed = useStaffAuthStore((s) => s.user?.role === "ADMIN" || s.user?.role === "GERENTE");
  const [incidents, setIncidents] = useState(() => ssmaStorage.incidents.list());
  const [dash, setDash] = useState<Record<string, unknown> | null>(null);
  const [perf, setPerf] = useState<Record<string, unknown> | null>(null);
  const [relTotal, setRelTotal] = useState<number | null>(null);
  const [clienteTotal, setClienteTotal] = useState<number | null>(null);
  const [auditoriaN, setAuditoriaN] = useState<number | null>(null);

  const [w2h, setW2h] = useState<Investigation5w2h>(() => ssmaStorage.investigation.get5w2h());
  const [fish, setFish] = useState<IshikawaBranches>(() => ssmaStorage.investigation.getIshikawa());
  const [timeline, setTimeline] = useState<TimelineStep[]>(() => ssmaStorage.investigation.getTimeline());

  const load = useCallback(async () => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    const di = start.toISOString().slice(0, 10);
    const df = end.toISOString().slice(0, 10);
    try {
      const [d, p, r, cl, aud] = await Promise.all([
        staffJson<Record<string, unknown>>(`/dashboard?dataInicio=${di}&dataFim=${df}`),
        staffJson<Record<string, unknown>>(`/dashboard-performance?dataInicio=${di}&dataFim=${df}`),
        staffJson<{ total?: number }>(`/relatorios/operacional/solicitacoes?dataInicio=${di}&dataFim=${df}&page=1&limit=1`).catch(() => ({ total: null })),
        staffJson<{ meta?: { total?: number } }>(`/clientes?page=1&limit=1`).catch(() => null),
        staffJson<{ data?: unknown[] }>(`/auditoria?limit=80&order=desc`).catch(() => ({ data: [] })),
      ]);
      setDash(d);
      setPerf(p);
      setRelTotal(r.total ?? null);
      setClienteTotal(cl?.meta?.total ?? null);
      setAuditoriaN(Array.isArray(aud.data) ? aud.data.length : 0);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha ao carregar dados SSMA");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const conflitos = dash?.conflitos as Record<string, number> | undefined;
  const gargalos = perf?.gargalos as Record<string, number> | undefined;
  const estr = perf?.estrategicos as Record<string, unknown> | undefined;

  const catalog = useMemo(
    () =>
      buildTerminalRiskCatalog({
        conflitos: conflitos
          ? {
              gatesSemPortaria: conflitos.gatesSemPortaria,
              saidasSemGateOuPatio: conflitos.saidasSemGateOuPatio,
              unidadesComISORepetido: conflitos.unidadesComISORepetido,
              tentativas403PorEscopo: conflitos.tentativas403PorEscopo,
            }
          : null,
        gargalosPerf: gargalos
          ? {
              violacoesGateSemPortaria: gargalos.violacoesGateSemPortaria,
              violacoesSaidaSemCompleto: gargalos.violacoesSaidaSemCompleto,
              isoDuplicado: gargalos.isoDuplicado,
            }
          : null,
        estrategicos: estr
          ? {
              ocupacaoPatioPercent: estr.ocupacaoPatioPercent as number | null | undefined,
              taxaGargaloDetectado: Boolean(estr.taxaGargaloDetectado),
              taxaRetrabalho: estr.taxaRetrabalho as number | null | undefined,
              throughputPortaria: estr.throughputPortaria as number | null | undefined,
              throughputGate: estr.throughputGate as number | null | undefined,
            }
          : null,
        relatorioTotalSolicitacoes: relTotal,
        incidents,
      }),
    [conflitos, gargalos, estr, relTotal, incidents],
  );

  const maxScore = catalog[0]?.score ?? 0;
  const patioIncidents = incidents.filter((i) => i.local === "patio").length;
  const oc = typeof estr?.ocupacaoPatioPercent === "number" ? estr.ocupacaoPatioPercent : 45;

  const heatOper = Math.min(100, maxScore * 3 + (conflitos ? Object.values(conflitos).reduce((a, b) => a + (b > 0 ? 8 : 0), 0) : 0));
  const retr = typeof estr?.taxaRetrabalho === "number" ? estr.taxaRetrabalho : 0;
  const heatProc = Math.max(15, Math.min(100, 100 - retr * 120));
  const violN = conflitos ? Object.values(conflitos).filter((x) => x > 0).length : 0;
  const heatConf = Math.max(20, 100 - violN * 12 - (estr?.taxaGargaloDetectado ? 15 : 0));

  function persistW2h(v: Investigation5w2h) {
    setW2h(v);
    ssmaStorage.investigation.set5w2h(v);
  }

  function persistFish(v: IshikawaBranches) {
    setFish(v);
    ssmaStorage.investigation.setIshikawa(v);
  }

  function persistTimeline(v: TimelineStep[]) {
    setTimeline(v);
    ssmaStorage.investigation.setTimeline(v);
  }

  function addTimelineStep() {
    persistTimeline([
      ...timeline,
      {
        id: crypto.randomUUID(),
        label: "Nova etapa",
        date: new Date().toISOString().slice(0, 16),
        detail: "",
      },
    ]);
  }

  if (!allowed) {
    return (
      <SsmaWorkspace>
        <p className="text-center text-amber-400">Acesso restrito.</p>
      </SsmaWorkspace>
    );
  }

  return (
    <SsmaWorkspace>
      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="lg:w-44 lg:shrink-0">
          <div className="sticky top-28 rounded-xl border border-amber-500/15 bg-[#0c0a08] p-3 text-[11px]">
            <p className="mb-2 font-bold uppercase tracking-wider text-amber-600/90">Índice</p>
            <ul className="space-y-1">
              {TOC.map((t) => (
                <li key={t.id}>
                  <a href={`#${t.id}`} className="block rounded px-2 py-1 text-zinc-400 hover:bg-white/5 hover:text-amber-300">
                    {t.label}
                  </a>
                </li>
              ))}
            </ul>
            <Button type="button" variant="ghost" size="sm" className="mt-3 w-full text-[10px]" onClick={() => void load()}>
              Atualizar API
            </Button>
          </div>
        </aside>
        <div className="min-w-0 flex-1 space-y-5">
          <p className="text-xs text-zinc-500">
            Leitura: <code className="text-zinc-400">/dashboard</code>, <code className="text-zinc-400">/dashboard-performance</code>,{" "}
            <code className="text-zinc-400">/relatorios/operacional/solicitacoes</code>, <code className="text-zinc-400">/clientes</code>,{" "}
            <code className="text-zinc-400">/auditoria</code>. Registros locais no navegador.
            {clienteTotal != null ? ` · ${clienteTotal} clientes.` : ""}
            {auditoriaN != null ? ` · ${auditoriaN} eventos de auditoria (amostra).` : ""}
          </p>

          <SsmaSection id="registro" title="Registro de incidentes" subtitle="Formulário SSMA + evidências (somente local)">
            <SsmaHeatLevels operacional={heatOper} processo={heatProc} conformidade={heatConf} />
            <div className="my-6 border-t border-white/10 pt-6">
              <IncidentForm
                onSaved={() => {
                  setIncidents(ssmaStorage.incidents.list());
                }}
              />
            </div>
            <div>
              <p className="mb-2 text-xs font-bold uppercase text-zinc-500">Histórico local ({incidents.length})</p>
              <ul className="max-h-48 space-y-2 overflow-auto text-xs text-zinc-400">
                {incidents.slice(0, 12).map((i) => (
                  <li key={i.id} className="rounded border border-white/5 bg-zinc-950/50 px-3 py-2">
                    <span className="text-amber-200">{i.tipo}</span> · {i.local} · {new Date(i.createdAt).toLocaleString()} — {i.descricao.slice(0, 80)}
                    {i.descricao.length > 80 ? "…" : ""}
                  </li>
                ))}
              </ul>
            </div>
          </SsmaSection>

          <SsmaSection id="investigacao" title="Investigação" subtitle="5W2H · Ishikawa · linha do tempo (local)">
            <p className="mb-3 text-[11px] font-bold uppercase text-amber-500/80">5W2H</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["what", "What"],
                  ["who", "Who"],
                  ["where", "Where"],
                  ["when", "When"],
                  ["why", "Why"],
                  ["how", "How"],
                  ["howMuch", "How much"],
                ] as const
              ).map(([k, lab]) => (
                <label key={k} className="text-[11px] text-zinc-500">
                  {lab}
                  <input
                    className="mt-1 w-full rounded border border-white/10 bg-zinc-900 px-2 py-2 text-sm"
                    value={w2h[k]}
                    onChange={(e) => persistW2h({ ...w2h, [k]: e.target.value })}
                  />
                </label>
              ))}
            </div>
            <div className="my-8 border-t border-white/10 pt-6">
              <p className="mb-3 text-[11px] font-bold uppercase text-amber-500/80">Diagrama Ishikawa</p>
              <IshikawaDiagram data={fish} onChange={persistFish} />
            </div>
            <div className="border-t border-white/10 pt-6">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase text-amber-500/80">Linha do tempo</p>
                <Button type="button" size="sm" variant="outline" className="h-7 border-zinc-600 text-[10px]" onClick={addTimelineStep}>
                  + Etapa
                </Button>
              </div>
              <ol className="space-y-3">
                {timeline.length === 0 ? <li className="text-sm text-zinc-500">Adicione etapas: evento → análise → recomendação → implantação.</li> : null}
                {timeline.map((step, idx) => (
                  <li key={step.id} className="rounded-xl border border-white/10 bg-zinc-950/40 p-3">
                    <span className="text-[10px] font-mono text-zinc-600">{idx + 1}</span>
                    <div className="mt-1 grid gap-2 sm:grid-cols-2">
                      <input
                        className="rounded border border-white/10 bg-zinc-900 px-2 py-1 text-sm"
                        value={step.label}
                        onChange={(e) =>
                          persistTimeline(timeline.map((t) => (t.id === step.id ? { ...t, label: e.target.value } : t)))
                        }
                      />
                      <input
                        type="datetime-local"
                        className="rounded border border-white/10 bg-zinc-900 px-2 py-1 text-sm"
                        value={step.date}
                        onChange={(e) =>
                          persistTimeline(timeline.map((t) => (t.id === step.id ? { ...t, date: e.target.value } : t)))
                        }
                      />
                    </div>
                    <textarea
                      className="mt-2 w-full rounded border border-white/10 bg-zinc-900 px-2 py-1 text-xs"
                      placeholder="Detalhe"
                      value={step.detail}
                      onChange={(e) =>
                        persistTimeline(timeline.map((t) => (t.id === step.id ? { ...t, detail: e.target.value } : t)))
                      }
                    />
                  </li>
                ))}
              </ol>
            </div>
          </SsmaSection>

          <SsmaSection id="catalogo" title="Catálogo de riscos do terminal" subtitle="Probabilidade × severidade · Score corporativo">
            <RiskMatrix items={catalog} />
          </SsmaSection>

          <SsmaSection id="mapa" title="Mapa de risco do pátio" subtitle="Grade de quadras — heurística operacional + incidentes locais (pátio)">
            <PatioRiskMap rows={4} cols={8} ocupacaoPct={oc} incidentsPatioCount={patioIncidents} catalogMaxScore={maxScore} />
          </SsmaSection>
        </div>
      </div>
    </SsmaWorkspace>
  );
}
