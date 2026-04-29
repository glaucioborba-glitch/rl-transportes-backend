"use client";

import type { OperationalSnapshot } from "@/lib/ai-console/operational-snapshot";

export function FlowRebalancer({ snap }: { snap: OperationalSnapshot }) {
  const congestedGate = snap.filaLens.gate > 10 || snap.taxaGargalo;
  const saturated = snap.sat > 82;
  const dwell = snap.estadiaCrit > 0;
  const arrivalSpike = snap.filaLens.portaria > 14;

  let cycleDelta = 0;
  const hints: string[] = [];
  if (congestedGate) {
    cycleDelta += 8;
    hints.push("Gate congestionado → reduzir in-flow simulado (~6%).");
  }
  if (saturated) {
    cycleDelta += 12;
    hints.push("Quadra saturada → auto-movimentação simulada para buffer.");
  }
  if (dwell) {
    cycleDelta += 5;
    hints.push("Dwell acima do alvo → antecipar gate-out prioritário.");
  }
  if (arrivalSpike) {
    cycleDelta += 4;
    hints.push("Pico chegadas → sugerir gate express (janelas curtas).");
  }
  if (!hints.length) hints.push("Fluxo equilibrado — rebalanceador em modo observação.");

  const estCiclo = snap.cicloMin != null ? snap.cicloMin + cycleDelta : null;

  return (
    <div className="rounded-2xl border border-cyan-500/20 bg-[#060c12] p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-300/80">Flow rebalancer</p>
      <ul className="mt-3 space-y-2 text-xs text-zinc-300">
        {hints.map((h, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-cyan-500">↺</span>
            {h}
          </li>
        ))}
      </ul>
      <p className="mt-4 font-mono text-[11px] text-zinc-500">
        Impacto estimado no ciclo completo: {cycleDelta > 0 ? `+${cycleDelta} min (stress)` : "±0 min"} · ciclo atual ~
        {estCiclo != null ? `${estCiclo.toFixed(0)} min` : "n/d"}
      </p>
    </div>
  );
}
