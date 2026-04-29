"use client";

import { cn } from "@/lib/utils";

const STEPS = [
  { id: "portaria", label: "Portaria" },
  { id: "gate", label: "Gate" },
  { id: "patio", label: "Pátio" },
  { id: "saida", label: "Saída" },
] as const;

type StepId = (typeof STEPS)[number]["id"];
type FlowHint = { step: StepId; label: string; risco: string };

export function OperationalRiskFlow({
  gatesSemPortaria,
  isoDup,
  taxaGargalo,
  ocupacaoPatio,
  saidaIncompleta,
}: {
  gatesSemPortaria: number;
  isoDup: number;
  taxaGargalo: boolean;
  ocupacaoPatio: number | null;
  saidaIncompleta: number;
}) {
  const hints: FlowHint[] = [];
  if (gatesSemPortaria > 0) {
    hints.push({ step: "gate", label: "Gate sem portaria", risco: "Integridade do fluxo / retrabalho" });
  }
  if (isoDup > 0) {
    hints.push({ step: "portaria", label: "ISO duplicado", risco: "Conflito documental / audit trail" });
  }
  if (taxaGargalo) {
    hints.push({ step: "gate", label: "Gargalo / fila", risco: "Congestionamento operacional" });
  }
  const oc = ocupacaoPatio ?? 0;
  if (oc >= 70) {
    hints.push({ step: "patio", label: `Ocupação ${oc}%`, risco: oc >= 85 ? "Saturação pátio" : "Risco de manobra" });
  }
  if (saidaIncompleta > 0) {
    hints.push({ step: "saida", label: "Saída sem completo", risco: "Ciclo incompleto / compliance" });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#070a12] p-4">
        {STEPS.map((s, i) => {
          const stepHints = hints.filter((h) => h.step === s.id);
          const stressed = stepHints.length > 0;
          return (
            <div key={s.id} className="flex min-w-[100px] flex-1 items-center gap-2">
              <div className="flex flex-1 flex-col items-center">
                <div
                  className={cn(
                    "w-full rounded-lg border px-3 py-3 text-center text-xs font-bold uppercase tracking-wide",
                    stressed ? "border-amber-500/50 bg-amber-950/40 text-amber-100" : "border-emerald-900/50 bg-emerald-950/20 text-emerald-200/80",
                  )}
                >
                  {s.label}
                </div>
                {stepHints.length ? (
                  <ul className="mt-2 w-full space-y-1 text-[10px] text-zinc-500">
                    {stepHints.map((h) => (
                      <li key={`${h.step}-${h.label}`} title={h.risco}>
                        <span className="text-amber-200/90">{h.label}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-[10px] text-zinc-600">Sem alerta API</p>
                )}
              </div>
              {i < STEPS.length - 1 ? (
                <span className="hidden shrink-0 text-zinc-600 sm:inline" aria-hidden>
                  →
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-zinc-600">
        Corredor alinhado ao fluxo portaria → gate → pátio → saída. Indicadores derivados de{" "}
        <code className="text-zinc-500">/dashboard</code> e <code className="text-zinc-500">/dashboard-performance</code>.
      </p>
    </div>
  );
}
