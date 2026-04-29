"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function BcpImpactSimulator({
  operadoresAtivos,
  ocupacaoPatioPct,
  taxaGargalo,
  filasTotais,
}: {
  operadoresAtivos: number;
  ocupacaoPatioPct: number | null;
  taxaGargalo: boolean;
  filasTotais: number;
}) {
  const [perdaPct, setPerdaPct] = useState(30);

  const sim = useMemo(() => {
    const base = Math.max(1, operadoresAtivos);
    const rem = Math.max(1, Math.round((base * (100 - perdaPct)) / 100));
    const stress = (ocupacaoPatioPct ?? 0) / 100 + (taxaGargalo ? 0.25 : 0) + Math.min(0.35, filasTotais / 200);
    const capRatio = rem / base;
    const queueRisk = Math.min(100, Math.round((1 - capRatio) * 65 + stress * 45));
    const gateRisk = Math.round((1 - capRatio) * 55 + (taxaGargalo ? 22 : 0));
    const patioRisk = Math.round((1 - capRatio) * 40 + (ocupacaoPatioPct ?? 0) * 0.45);

    let fallback = "Reativação de plano de escala (12/36h), priorização por SLA de cliente A e bloqueio de novas janelas até normalizar fila.";
    if (queueRisk >= 75) {
      fallback = "Acionar terceiro para gate/portaria, pausar stage de pátio não crítico e comunicação proativa aos clientes top5.";
    } else if (queueRisk >= 55) {
      fallback = "Dupla checagem na portaria, desvio de carga para turno alternativo e reforço de supervisão no pátio.";
    }

    return { rem, queueRisk, gateRisk, patioRisk, fallback };
  }, [operadoresAtivos, ocupacaoPatioPct, taxaGargalo, filasTotais, perdaPct]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-white/10 bg-[#060914]/90 p-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-sky-300/90">Simulação rápida BCP</p>
        <p className="mt-2 text-sm text-zinc-400">
          Modelo simplificado: perda linear de capacidade humana vs filas e saturação atuais (somente front).
        </p>
        <label className="mt-6 block text-[11px] text-zinc-500">
          Perda de equipe operacional
          <div className="mt-2 flex items-center gap-4">
            <input
              type="range"
              min={10}
              max={50}
              step={5}
              value={perdaPct}
              onChange={(e) => setPerdaPct(Number(e.target.value))}
              className="h-2 flex-1 accent-sky-500"
            />
            <span className="w-14 font-mono text-lg text-white">{perdaPct}%</span>
          </div>
        </label>
        <p className="mt-4 text-[11px] text-zinc-600">
          Operadores ativos (24h): <span className="font-mono text-zinc-400">{operadoresAtivos}</span> → efetivo pós choque:{" "}
          <span className="font-mono text-sky-200">{sim.rem}</span>
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" className="border-zinc-600" onClick={() => setPerdaPct(30)}>
            Cenário −30%
          </Button>
          <Button type="button" size="sm" variant="outline" className="border-zinc-600" onClick={() => setPerdaPct(40)}>
            Cenário −40%
          </Button>
        </div>
      </div>
      <div className="space-y-3 rounded-2xl border border-amber-500/20 bg-amber-950/10 p-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-200/90">Impacto no fluxo</p>
        <Meter label="Risco fila / portaria" v={sim.queueRisk} />
        <Meter label="Risco gate" v={sim.gateRisk} />
        <Meter label="Risco pátio / dwell" v={sim.patioRisk} />
        <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4">
          <p className="text-[10px] font-bold uppercase text-zinc-500">Fallback sugerido</p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-200">{sim.fallback}</p>
        </div>
      </div>
    </div>
  );
}

function Meter({ label, v }: { label: string; v: number }) {
  const tone = v >= 70 ? "bg-red-500/80" : v >= 45 ? "bg-amber-500/80" : "bg-emerald-500/70";
  return (
    <div>
      <div className="flex justify-between text-[11px] text-zinc-500">
        <span>{label}</span>
        <span className="font-mono text-zinc-300">{v}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-900">
        <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}
