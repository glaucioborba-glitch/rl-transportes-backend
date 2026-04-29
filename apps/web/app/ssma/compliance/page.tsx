"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SsmaWorkspace } from "@/components/ssma/ssma-workspace";
import { SsmaSection } from "@/components/ssma/ssma-section";
import { NrComplianceBoard } from "@/components/ssma/nr-compliance-board";
import { EpiTracker } from "@/components/ssma/epi-tracker";
import { AuditSecurityTable, type AuditRow } from "@/components/ssma/audit-security-table";
import { NrControlHeatmap } from "@/components/ssma/nr-control-heatmap";
import { CriticalAlertsPanel, type AlertItem } from "@/components/ssma/critical-alerts-panel";
import { ApiError, staffJson } from "@/lib/api/staff-client";
import { toast } from "@/lib/toast";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { Button } from "@/components/ui/button";

function mapAud(d: unknown): AuditRow[] {
  if (!d || typeof d !== "object") return [];
  const o = d as { data?: unknown[] };
  const arr = o.data;
  if (!Array.isArray(arr)) return [];
  return arr.map((x) => {
    const r = x as Record<string, unknown>;
    return {
      id: String(r.id ?? ""),
      createdAt: String(r.createdAt ?? ""),
      tabela: String(r.tabela ?? ""),
      acao: String(r.acao ?? ""),
      usuario: r.usuario != null ? String(r.usuario) : null,
      registroId: r.registroId != null ? String(r.registroId) : null,
      dadosDepois: r.dadosDepois,
    };
  });
}

export default function SsmaCompliancePage() {
  const allowed = useStaffAuthStore((s) => s.user?.role === "ADMIN" || s.user?.role === "GERENTE");
  const [audSol, setAudSol] = useState<AuditRow[]>([]);
  const [audUsers, setAudUsers] = useState<AuditRow[]>([]);
  const [audGates, setAudGates] = useState<AuditRow[]>([]);
  const [dash, setDash] = useState<Record<string, unknown> | null>(null);
  const [perf, setPerf] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 14);
    const di = start.toISOString().slice(0, 10);
    const df = end.toISOString().slice(0, 10);
    try {
      const [d, p, a1, a2, a3] = await Promise.all([
        staffJson<Record<string, unknown>>(`/dashboard?dataInicio=${di}&dataFim=${df}`),
        staffJson<Record<string, unknown>>(`/dashboard-performance?dataInicio=${di}&dataFim=${df}`),
        staffJson<unknown>(`/auditoria?tabela=solicitacoes&limit=40&order=desc`).catch(() => ({ data: [] })),
        staffJson<unknown>(`/auditoria?tabela=users&limit=40&order=desc`).catch(() => ({ data: [] })),
        staffJson<unknown>(`/auditoria?tabela=gates&limit=40&order=desc`).catch(() => ({ data: [] })),
      ]);
      setDash(d);
      setPerf(p);
      setAudSol(mapAud(a1));
      setAudUsers(mapAud(a2));
      setAudGates(mapAud(a3));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha compliance");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const conflitos = dash?.conflitos as Record<string, number> | undefined;
  const taxaGar = Boolean((perf?.estrategicos as Record<string, unknown> | undefined)?.taxaGargaloDetectado);
  const retr = (perf?.estrategicos as { taxaRetrabalho?: number | null } | undefined)?.taxaRetrabalho ?? 0;

  const alerts: AlertItem[] = useMemo(() => {
    const a: AlertItem[] = [];
    if ((conflitos?.tentativas403PorEscopo ?? 0) > 0) {
      a.push({
        id: "403",
        level: "alta",
        titulo: "Escopo / 403",
        detalhe: `${conflitos?.tentativas403PorEscopo} tentativas registradas no dashboard.`,
      });
    }
    if ((conflitos?.gatesSemPortaria ?? 0) > 0) {
      a.push({
        id: "gate",
        level: "alta",
        titulo: "Integridade gate/portaria",
        detalhe: `${conflitos?.gatesSemPortaria} ocorrências.`,
      });
    }
    if (taxaGar) {
      a.push({ id: "gar", level: "media", titulo: "Gargalo operacional", detalhe: "Fila acima do limite configurado." });
    }
    if (retr > 0.25) {
      a.push({ id: "ret", level: "media", titulo: "Retrabalho elevado", detalhe: `Taxa ~${(retr * 100).toFixed(0)}% (proxy).` });
    }
    const suspeitos = [...audSol, ...audUsers, ...audGates].filter((r) => /UPDATE|DELETE/i.test(r.acao));
    if (suspeitos.length > 8) {
      a.push({
        id: "aud",
        level: "baixa",
        titulo: "Volume de alterações",
        detalhe: `${suspeitos.length} eventos UPDATE/DELETE nas trilhas filtradas.`,
      });
    }
    return a;
  }, [conflitos, taxaGar, retr, audSol, audUsers, audGates]);

  const heatCell = useCallback(
    (ti: number, ni: number) => {
      let v = 78 - ti * 4 + ni * 2;
      if (taxaGar) v -= 12;
      v -= Math.round(retr * 40);
      if ((conflitos?.tentativas403PorEscopo ?? 0) > 0) v -= 8;
      return Math.max(35, Math.min(98, v));
    },
    [taxaGar, retr, conflitos],
  );

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
            <ul className="space-y-1 text-zinc-400">
              <li>
                <a href="#nr" className="block rounded px-2 py-1 hover:bg-white/5 hover:text-amber-300">
                  Central NR
                </a>
              </li>
              <li>
                <a href="#epi" className="block rounded px-2 py-1 hover:bg-white/5 hover:text-amber-300">
                  EPI/EPC
                </a>
              </li>
              <li>
                <a href="#audit" className="block rounded px-2 py-1 hover:bg-white/5 hover:text-amber-300">
                  Auditoria
                </a>
              </li>
              <li>
                <a href="#sala" className="block rounded px-2 py-1 hover:bg-white/5 hover:text-amber-300">
                  NR Room
                </a>
              </li>
            </ul>
            <Button type="button" variant="ghost" size="sm" className="mt-3 w-full text-[10px]" onClick={() => void load()}>
              Atualizar
            </Button>
          </div>
        </aside>
        <div className="min-w-0 flex-1 space-y-5">
          <p className="text-xs text-zinc-500">
            Rotas: <code className="text-zinc-400">/auditoria</code>, <code className="text-zinc-400">/dashboard</code>,{" "}
            <code className="text-zinc-400">/dashboard-performance</code>, <code className="text-zinc-400">/users</code> (em outras telas).
          </p>

          <SsmaSection id="nr" title="Central NR" subtitle="Validade simulada · indicadores (armazenamento local para treinamentos)">
            <NrComplianceBoard />
          </SsmaSection>

          <SsmaSection id="epi" title="EPI / EPC tracker" subtitle="Inventário e logs — somente navegador">
            <EpiTracker />
          </SsmaSection>

          <SsmaSection id="audit" title="Auditoria de segurança" subtitle="Leitura GET /auditoria por tabela">
            <div className="grid gap-6 lg:grid-cols-1">
              <AuditSecurityTable title="Solicitações" rows={audSol} />
              <AuditSecurityTable title="Users" rows={audUsers} />
              <AuditSecurityTable title="Gates" rows={audGates} />
            </div>
          </SsmaSection>

          <SsmaSection id="sala" title="Sala de controle NR" subtitle="Heatmap heurístico operador × NR · alertas">
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-bold text-zinc-500">Conformidade por turno × NR (%)</p>
                <NrControlHeatmap cell={heatCell} />
              </div>
              <div>
                <p className="mb-2 text-xs font-bold text-zinc-500">Alertas críticos</p>
                <CriticalAlertsPanel alerts={alerts.length ? alerts : [{ id: "ok", level: "baixa", titulo: "Nenhum alerta prioritário", detalhe: "Situação estável no recorte." }]} />
                <p className="mt-4 text-[11px] text-zinc-600">Recomendações automáticas são heurísticas locais; cruzar com PPP e PCMSE.</p>
              </div>
            </div>
          </SsmaSection>
        </div>
      </div>
    </SsmaWorkspace>
  );
}
