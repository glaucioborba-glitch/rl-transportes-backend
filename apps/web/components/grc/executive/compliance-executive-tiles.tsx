"use client";

import { cn } from "@/lib/utils";

type Tone = "ok" | "warn" | "crit";

function bandFromComposite(pctCtrl: number, pctRisk: number, incidents: number, matur: number): Tone {
  let bad = 0;
  if (pctCtrl < 55) bad += 2;
  else if (pctCtrl < 70) bad += 1;
  if (pctRisk > 55) bad += 2;
  else if (pctRisk > 35) bad += 1;
  if (incidents > 2) bad += 2;
  else if (incidents > 0) bad += 1;
  if (matur < 45) bad += 1;
  else if (matur < 55) bad += 0.5;
  if (bad >= 4) return "crit";
  if (bad >= 2) return "warn";
  return "ok";
}

function Tile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: Tone;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-5 shadow-lg transition-colors",
        tone === "ok" && "border-emerald-500/25 bg-gradient-to-br from-emerald-950/30 to-[#070a12]",
        tone === "warn" && "border-amber-500/30 bg-gradient-to-br from-amber-950/25 to-[#070a12]",
        tone === "crit" && "border-red-500/30 bg-gradient-to-br from-red-950/30 to-[#070a12]",
      )}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">{label}</p>
      <p className="mt-3 font-mono text-3xl font-light tabular-nums text-white">{value}</p>
      <p className="mt-2 text-xs leading-relaxed text-zinc-500">{sub}</p>
    </div>
  );
}

export function ComplianceExecutiveTiles({
  pctControlesEfetivos,
  pctRiscosModeradosCriticos,
  incidentesCriticos,
  maturidadeIso31000,
  integrityScore,
}: {
  pctControlesEfetivos: number;
  pctRiscosModeradosCriticos: number;
  incidentesCriticos: number;
  maturidadeIso31000: number;
  integrityScore: number;
}) {
  const panel = bandFromComposite(pctControlesEfetivos, pctRiscosModeradosCriticos, incidentesCriticos, maturidadeIso31000);

  const bandLabel =
    panel === "ok" ? "Alta conformidade relativa" : panel === "warn" ? "Atenção — gaps identificados" : "Risco — ação dirigida recomendada";

  const bandClass =
    panel === "ok"
      ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-100"
      : panel === "warn"
        ? "border-amber-500/35 bg-amber-950/20 text-amber-100"
        : "border-red-500/35 bg-red-950/20 text-red-100";

  return (
    <div className="space-y-4">
      <div className={cn("rounded-2xl border px-5 py-4", bandClass)}>
        <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">Painel executivo · conformidade</p>
        <p className="mt-1 text-lg font-semibold">{bandLabel}</p>
        <p className="mt-1 text-xs opacity-90">
          Integridade operacional API: <span className="font-mono font-bold">{integrityScore}</span>/100 — combina violações de fluxo, escopo e saturação.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label="Controles efetivos (COSO)"
          value={`${pctControlesEfetivos}%`}
          sub="Percentual na matriz de controles internos persistida no navegador."
          tone={pctControlesEfetivos >= 70 ? "ok" : pctControlesEfetivos >= 50 ? "warn" : "crit"}
        />
        <Tile
          label="Riscos moderados ou críticos"
          value={`${pctRiscosModeradosCriticos}%`}
          sub="Registro ISO 31000: participação de riscos com nível ≥ 4 (heat P×I)."
          tone={pctRiscosModeradosCriticos <= 35 ? "ok" : pctRiscosModeradosCriticos <= 55 ? "warn" : "crit"}
        />
        <Tile
          label="Incidentes críticos (SSMA)"
          value={`${incidentesCriticos}`}
          sub="Incidentes locais com tipo “crítico” ou risco percebido “alto”."
          tone={incidentesCriticos === 0 ? "ok" : incidentesCriticos <= 2 ? "warn" : "crit"}
        />
        <Tile
          label="Maturidade ISO 31000"
          value={`${maturidadeIso31000}`}
          sub="Índice heurístico 0–100 (cadastro, 4Ts e dispersão por categoria)."
          tone={maturidadeIso31000 >= 60 ? "ok" : maturidadeIso31000 >= 45 ? "warn" : "crit"}
        />
      </div>
    </div>
  );
}
