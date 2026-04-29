"use client";

import { useMemo, useRef, useEffect, useState } from "react";
import { TwinMap } from "@/components/digital-twin/twin-map";
import { TwinEventLayer, type TwinFlashEvent } from "@/components/digital-twin/twin-event-layer";
import { TwinTruckFlow } from "@/components/digital-twin/twin-truck-flow";
import { TwinGlobalStatus } from "@/components/digital-twin/twin-global-status";
import { TwinQuadraCard } from "@/components/digital-twin/twin-quadra-card";
import { useTwinTelemetry } from "@/lib/digital-twin/use-twin-telemetry";
import {
  globalTerminalMode,
  mapQuadrasFromDashboard,
  riskBandFromTelemetry,
  violacoesCount,
} from "@/lib/digital-twin/derive";
import { Button } from "@/components/ui/button";

export default function DigitalTwinTerminalPage() {
  const { bundle, refresh } = useTwinTelemetry(true);
  const prev = useRef({ p: 0, g: 0, patio: 0, sat: 0 });
  const [events, setEvents] = useState<TwinFlashEvent[]>([]);

  const model = useMemo(() => {
    if (!bundle?.dash) return null;
    const dash = bundle.dash;
    const cap = bundle.cap;
    const perf = bundle.perf;

    const filas = dash.filas as
      | {
          filaPortaria?: { length: number } | unknown[];
          filaGate?: unknown[];
          filaPatio?: Array<{ quadra?: string; quantidadeUnidades?: number; ordenadoPor?: string }>;
          filaSaida?: unknown[];
        }
      | undefined;

    const filaLens = {
      portaria: Array.isArray(filas?.filaPortaria) ? filas!.filaPortaria!.length : 0,
      gate: Array.isArray(filas?.filaGate) ? filas!.filaGate!.length : 0,
      patio: Array.isArray(filas?.filaPatio) ? filas!.filaPatio!.length : 0,
      saida: Array.isArray(filas?.filaSaida) ? filas!.filaSaida!.length : 0,
    };

    const prob = (dash.snapshot as { unidadesComProblemas?: Record<string, unknown> } | undefined)?.unidadesComProblemas;
    const conflitos = dash.conflitos as Record<string, number> | undefined;
    const sla = dash.sla as { unidadesComEstadiaCritica?: number; idadeMediaEstadiaHoras?: number | null } | undefined;

    const viol = {
      gates: Math.max(Number(prob?.gatesSemPortaria ?? 0), Number(conflitos?.gatesSemPortaria ?? 0)),
      iso: Number(prob?.isoDuplicadoEmSolicitacoesAtivas ?? 0),
      saidas: Math.max(Number(prob?.saidasSemGateOuPatio ?? 0), Number(conflitos?.saidasSemGateOuPatio ?? 0)),
      t403: Number(conflitos?.tentativas403PorEscopo ?? 0),
    };

    const satFromCap = Number(cap?.fatorSaturacaoPct ?? 0);
    const perfEstr = perf?.estrategicos as { ocupacaoPatioPercent?: number | null } | undefined;
    const sat = satFromCap || Number(perfEstr?.ocupacaoPatioPercent ?? 0) || 0;

    const estr = perf?.estrategicos as { taxaGargaloDetectado?: boolean; taxaRetrabalho?: number | null } | undefined;
    const taxaGargalo = Boolean(estr?.taxaGargaloDetectado);
    const retr = Number(estr?.taxaRetrabalho ?? 0);

    const vb = violacoesCount({
      gatesSemPortaria: viol.gates,
      isoDup: viol.iso,
      saidasRuins: viol.saidas,
      tentativas403: viol.t403,
    });

    const estadiaCrit = Number(sla?.unidadesComEstadiaCritica ?? 0);
    const band = riskBandFromTelemetry({ saturacaoPct: sat, taxaGargalo, violacoes: vb, estadiaCritica: estadiaCrit });

    const ciclo = (cap?.cicloMedioMinutos ?? null) as number | null;

    const mode = globalTerminalMode({
      saturacaoPct: sat,
      taxaGargalo,
      violacoes: vb,
      cicloMedMin: ciclo,
      estadiaCritica: estadiaCrit,
    });

    const quadras = mapQuadrasFromDashboard({
      filaPatio: (Array.isArray(filas?.filaPatio) ? filas!.filaPatio! : []) as {
        quadra?: string | null;
        quantidadeUnidades?: number;
        ordenadoPor?: string;
      }[],
      quadrasDistintas: Number(cap?.quadrasDistintas ?? 6),
      slotsPorQuadraEstimado: Number(cap?.slotsPorQuadraEstimado ?? 40),
      idadeMediaEstadiaHoras: sla?.idadeMediaEstadiaHoras ?? null,
    });

    const tpGate = Number(cap?.capacidadeGateUnidadesPorHoraMedia ?? 8);

    return {
      filaLens,
      viol,
      sat,
      taxaGargalo,
      retr,
      vb,
      band,
      mode,
      quadras,
      tpGate,
      estadiaCrit,
      ciclo,
      relTotal: Number((bundle.rel as { total?: number } | null)?.total ?? 0),
    };
  }, [bundle]);

  useEffect(() => {
    if (!model || !bundle?.updatedAt) return;
    const now = Date.now();
    const pr = prev.current;
    const nextEv: TwinFlashEvent[] = [];
    if (model.filaLens.portaria > pr.p + 2) {
      nextEv.push({ id: `sp-p-${now}`, kind: "spike", label: "Pico portaria", xPct: 22, yPct: 18, until: now + 4500 });
    }
    if (model.vb > 0) {
      nextEv.push({ id: `al-${now}`, kind: "alert", label: "Desvio / violação", xPct: 42, yPct: 28, until: now + 5000 });
    }
    if (model.filaLens.saida > pr.g + 2) {
      nextEv.push({ id: `go-${now}`, kind: "gate_out", label: "Gate-out", xPct: 72, yPct: 82, until: now + 4000 });
    }
    prev.current = {
      p: model.filaLens.portaria,
      g: model.filaLens.saida,
      patio: model.filaLens.patio,
      sat: model.sat,
    };
    setEvents((cur) => [...cur.filter((e) => e.until > now), ...nextEv].slice(-12));
  }, [bundle?.updatedAt, model]);

  if (!bundle || !model) {
    return (
      <div className="space-y-4">
        <p className="text-zinc-500">Sincronizando telemetria do terminal…</p>
        <Button type="button" variant="outline" onClick={() => void refresh()}>
          Tentar agora
        </Button>
      </div>
    );
  }

  const intensity = Math.min(10, Math.round(model.filaLens.portaria / 3 + model.filaLens.gate / 3));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-light text-white">Terminal virtual · tempo real</h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-500">
            Mapa 2.5D derivado de <code className="text-zinc-600">/dashboard</code>, <code className="text-zinc-600">/dashboard-performance</code>,{" "}
            <code className="text-zinc-600">/simulador/capacidade</code> e projeções. Atualização automática a cada ~8s.
          </p>
        </div>
        <Button type="button" variant="outline" className="border-cyan-500/40" onClick={() => void refresh()}>
          Forçar sync
        </Button>
      </div>

      <TwinGlobalStatus mode={model.mode} band={model.band} satPct={model.sat} updatedAt={bundle.updatedAt} />

      <div className="grid gap-6 xl:grid-cols-12">
        <div className="relative xl:col-span-8">
          <TwinMap
            quadras={model.quadras}
            band={model.band}
            filaLens={model.filaLens}
            satPct={model.sat}
            taxaGargalo={model.taxaGargalo}
            violacoes={model.viol}
            estadiaCritica={model.estadiaCrit}
          />
          <TwinEventLayer events={events} />
        </div>
        <div className="space-y-4 xl:col-span-4">
          <TwinTruckFlow intensity={intensity} />
          <div className="rounded-2xl border border-white/10 bg-[#050914] p-4 text-[11px] text-zinc-400">
            <p className="font-bold uppercase text-cyan-400/80">Telemetria ao vivo</p>
            <ul className="mt-3 space-y-2 font-mono text-[10px]">
              <li>Fila portaria / gate / pátio / saída: {model.filaLens.portaria} · {model.filaLens.gate} · {model.filaLens.patio} · {model.filaLens.saida}</li>
              <li>Saturação pátio: {model.sat.toFixed(1)}%</li>
              <li>Throughput gate (média): {model.tpGate.toFixed(1)} u/h</li>
              <li>Retrabalho proxy: {(model.retr * 100).toFixed(1)}%</li>
              <li>Não conformidades (soma): {model.vb}</li>
              <li>Solicitações (período BI): {model.relTotal}</li>
            </ul>
          </div>
        </div>
      </div>

      <div>
        <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Quadras · estado local</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {model.quadras.map((q) => (
            <TwinQuadraCard key={q.id} q={q} throughputProxy={model.tpGate / Math.max(1, model.quadras.length)} />
          ))}
        </div>
      </div>
    </div>
  );
}
