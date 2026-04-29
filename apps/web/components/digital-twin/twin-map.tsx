"use client";

import { cn } from "@/lib/utils";
import type { MappedQuadra, TwinRiskBand } from "@/lib/digital-twin/derive";
import { bandColorCss, riskBandFromTelemetry, violacoesCount } from "@/lib/digital-twin/derive";

type TwinMapProps = {
  quadras: MappedQuadra[];
  band: TwinRiskBand;
  filaLens: { portaria: number; gate: number; patio: number; saida: number };
  satPct: number;
  taxaGargalo: boolean;
  violacoes: { gates: number; iso: number; saidas: number; t403: number };
  estadiaCritica: number;
};

export function TwinMap({ quadras, band, filaLens, satPct, taxaGargalo, violacoes, estadiaCritica }: TwinMapProps) {
  const vb = violacoesCount({
    gatesSemPortaria: violacoes.gates,
    isoDup: violacoes.iso,
    saidasRuins: violacoes.saidas,
    tentativas403: violacoes.t403,
  });
  const zoneBand = riskBandFromTelemetry({ saturacaoPct: satPct, taxaGargalo, violacoes: vb, estadiaCritica });

  const Zone = ({
    title,
    sub,
    className,
    children,
    zb,
  }: {
    title: string;
    sub?: string;
    className?: string;
    children?: React.ReactNode;
    zb?: TwinRiskBand;
  }) => {
    const c = bandColorCss(zb ?? band);
    return (
      <div
        className={cn(
          "relative flex flex-col justify-between rounded-2xl border-2 p-4 shadow-lg transition-all duration-500",
          className,
        )}
        style={{ borderColor: c.stroke, boxShadow: `0 0 24px ${c.glow}` }}
      >
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{title}</p>
          {sub ? <p className="mt-1 font-mono text-lg text-white">{sub}</p> : null}
        </div>
        {children}
      </div>
    );
  };

  const patioCols = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(Math.max(4, quadras.length || 4)))));

  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-cyan-500/15 bg-gradient-to-br from-[#060b18] to-[#02040a] p-4 lg:p-6"
      style={{ transform: "perspective(1200px) rotateX(6deg)" }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(34,211,238,0.06),transparent_55%)]" />
      <div className="relative grid min-h-[420px] grid-cols-12 grid-rows-12 gap-3">
        <Zone
          title="Portaria · gate-in"
          sub={`${filaLens.portaria} fila`}
          className="col-span-5 row-span-3"
          zb={filaLens.portaria > 12 ? "semi" : "normal"}
        />
        <Zone
          title="Gate"
          sub={`${filaLens.gate} fila`}
          className="col-span-3 row-span-3"
          zb={taxaGargalo ? "crit" : filaLens.gate > 10 ? "semi" : "normal"}
        />
        <Zone
          title="Estacionamento"
          sub="buffer"
          className="col-span-4 row-span-3"
          zb="normal"
        >
          <p className="text-[10px] text-zinc-600">Caminhões aguardando doca / liberação.</p>
        </Zone>

        <div
          className="col-span-12 row-span-6 rounded-2xl border-2 border-dashed p-3 lg:col-span-12"
          style={{ borderColor: bandColorCss(zoneBand).stroke }}
        >
          <p className="text-center text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-300/70">Pátio · quadras</p>
          <div
            className="mt-3 grid gap-2"
            style={{ gridTemplateColumns: `repeat(${patioCols}, minmax(0, 1fr))` }}
          >
            {(quadras.length ? quadras : [{ id: "Q1", label: "Q1", ocupacao: 0, dwellProxyMin: null, risk: "normal" as const }]).map((q) => {
              const c = bandColorCss(q.risk);
              return (
                <div
                  key={q.id}
                  className="flex min-h-[72px] flex-col justify-end rounded-xl border bg-black/30 p-2 transition-all"
                  style={{ borderColor: c.stroke }}
                >
                  <p className="text-[10px] font-bold text-white">{q.label}</p>
                  <p className="font-mono text-xs text-cyan-200/80">{q.ocupacao} u</p>
                  <div className="mt-1 h-1 rounded bg-zinc-800">
                    <div className="h-1 rounded" style={{ width: `${Math.min(100, satPct)}%`, background: c.stroke }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <Zone
          title="Saída · gate-out"
          sub={`${filaLens.saida} pend.`}
          className="col-span-7 row-span-3"
          zb={filaLens.saida > 8 ? "semi" : "normal"}
        />
        <Zone title="Corredor interno" sub="movimentação" className="col-span-5 row-span-3" zb={band}>
          <p className="text-[10px] leading-relaxed text-zinc-500">
            Contêineres entre quadras e gate-out simulados a partir das filas ativas.
          </p>
        </Zone>
      </div>
    </div>
  );
}
