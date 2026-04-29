"use client";

import { useState } from "react";
import { SsmaWorkspace } from "@/components/ssma/ssma-workspace";
import { SsmaSection } from "@/components/ssma/ssma-section";
import { PtwForm } from "@/components/ssma/ptw-form";
import { SafetyChecklist } from "@/components/ssma/safety-checklist";
import { RcaVisualizer } from "@/components/ssma/rca-visualizer";
import { MaturityRadar } from "@/components/ssma/maturity-radar";
import { ActionPlanBoard } from "@/components/ssma/action-plan-board";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { ssmaStorage } from "@/lib/ssma/storage";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "ptw", label: "PTW" },
  { id: "chk", label: "Checklist" },
  { id: "rca", label: "Investigação" },
  { id: "mat", label: "Maturidade" },
  { id: "act", label: "5W2H plano" },
] as const;

export default function SsmaPtwPage() {
  const allowed = useStaffAuthStore((s) => s.user?.role === "ADMIN" || s.user?.role === "GERENTE");
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("ptw");
  const [, bump] = useState(0);

  if (!allowed) {
    return (
      <SsmaWorkspace>
        <p className="text-center text-amber-400">Acesso restrito.</p>
      </SsmaWorkspace>
    );
  }

  return (
    <SsmaWorkspace>
      <div className="mb-6 flex flex-wrap gap-2 border-b border-white/10 pb-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wide",
              tab === t.id ? "bg-amber-600/90 text-white" : "bg-zinc-900 text-zinc-500 hover:text-zinc-300",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "ptw" ? (
        <SsmaSection title="Permissão de trabalho (PTW)" subtitle="Fluxo local: rascunho → enviado → aprovado → encerrado · assinatura em canvas">
          <PtwForm
            onSaved={() => {
              bump((x) => x + 1);
            }}
          />
          <div className="mt-6 border-t border-white/10 pt-4">
            <p className="mb-2 text-xs font-bold text-zinc-500">Últimas PTWs (local)</p>
            <ul className="space-y-2 text-xs text-zinc-400">
              {ssmaStorage.ptw.list().slice(0, 6).map((p) => (
                <li key={p.id} className="rounded border border-white/5 px-3 py-2 font-mono">
                  {p.status} · {p.tipo} · válido até {p.validadeAte} · {p.executor}
                </li>
              ))}
            </ul>
          </div>
        </SsmaSection>
      ) : null}

      {tab === "chk" ? (
        <SsmaSection title="Checklist de segurança" subtitle="Status · notas · evidências">
          <SafetyChecklist />
        </SsmaSection>
      ) : null}

      {tab === "rca" ? (
        <SsmaSection title="Investigação avançada" subtitle="5 porquês · árvore de falhas · RCA visual">
          <RcaVisualizer />
        </SsmaSection>
      ) : null}

      {tab === "mat" ? (
        <SsmaSection title="Maturidade de cultura (modelo local)" subtitle="Níveis reativos a excelência — indicadores simulados">
          <MaturityRadar />
        </SsmaSection>
      ) : null}

      {tab === "act" ? (
        <SsmaSection title="Plano de ação 5W2H" subtitle="Timeline de melhoria contínua (local)">
          <ActionPlanBoard />
        </SsmaSection>
      ) : null}
    </SsmaWorkspace>
  );
}
