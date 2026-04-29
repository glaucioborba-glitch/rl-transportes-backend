"use client";

import { cn } from "@/lib/utils";
import type { SdtPhase } from "@/lib/sdt/decision-engine-core";

const PHASE_STYLE: Record<SdtPhase, string> = {
  normal: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  atencao: "border-amber-500/40 bg-amber-500/10 text-amber-100",
  critico: "border-orange-600/50 bg-orange-950/40 text-orange-100",
  colapso: "border-red-600/60 bg-red-950/50 text-red-100 animate-pulse",
};

const PHASE_LABEL: Record<SdtPhase, string> = {
  normal: "Normal",
  atencao: "Atenção",
  critico: "Crítico",
  colapso: "Colapso iminente",
};

export function DecisionStateInterpreter({
  phase,
  tpPortaria,
  tpGate,
  sat,
  dwellCrit,
  retr,
  iaProbPct,
  violacoes,
}: {
  phase: SdtPhase;
  tpPortaria: number;
  tpGate: number;
  sat: number;
  dwellCrit: number;
  retr: number;
  iaProbPct: number;
  violacoes: number;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#050a08] p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-400/80">State interpreter</p>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <div className={cn("rounded-2xl border-2 px-5 py-3 font-mono text-2xl font-semibold", PHASE_STYLE[phase])}>
          {PHASE_LABEL[phase]}
        </div>
        <dl className="grid flex-1 gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-zinc-500">Throughput P / G</dt>
            <dd className="font-mono text-white">
              {tpPortaria.toFixed(0)} / {tpGate.toFixed(0)} u/h
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Saturação</dt>
            <dd className="font-mono text-white">{sat.toFixed(1)}%</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Dwell crítico / Retrabalho</dt>
            <dd className="font-mono text-white">
              {dwellCrit} u · {(retr * 100).toFixed(1)}%
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">IA gargalo (máx.)</dt>
            <dd className="font-mono text-cyan-300">{iaProbPct.toFixed(0)}%</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Violações</dt>
            <dd className="font-mono text-white">{violacoes}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
