import {
  globalTerminalMode,
  riskBandFromTelemetry,
  violacoesCount,
  type TwinGlobalMode,
  type TwinRiskBand,
} from "@/lib/digital-twin/derive";

export type OperationalSnapshot = {
  filaLens: { portaria: number; gate: number; patio: number; saida: number };
  sat: number;
  taxaGargalo: boolean;
  retr: number;
  vb: number;
  mode: TwinGlobalMode;
  band: TwinRiskBand;
  tpPortaria: number;
  tpGate: number;
  tpPatio: number;
  cicloMin: number | null;
  estadiaCrit: number;
  relTotal: number;
  projLabel: string | null;
};

export type IaGargaloBlob = { horizontes?: unknown[] } | null;

export function maxGargaloProb(gar: IaGargaloBlob): number {
  const hs = gar?.horizontes ?? [];
  let m = 0;
  for (const raw of hs) {
    const h = raw as Record<string, unknown>;
    const keys = ["probabilidadePortaria", "probabilidadeGate", "probabilidadePatio", "probabilidadeSaida"] as const;
    const row = keys.map((k) => Number(h[k])).filter((x) => Number.isFinite(x));
    const v = row.length ? Math.max(0, ...row) : 0;
    if (v > m) m = v;
  }
  return m;
}

export function buildOperationalSnapshot(args: {
  dash: Record<string, unknown> | null;
  perf: Record<string, unknown> | null;
  cap: Record<string, unknown> | null;
  proj: Record<string, unknown> | null;
  rel: Record<string, unknown> | null;
}): OperationalSnapshot | null {
  if (!args.dash) return null;

  const dash = args.dash;
  const cap = args.cap;
  const perf = args.perf;

  const filas = dash.filas as
    | {
        filaPortaria?: unknown[];
        filaGate?: unknown[];
        filaPatio?: unknown[];
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

  const vb = violacoesCount({
    gatesSemPortaria: Math.max(Number(prob?.gatesSemPortaria ?? 0), Number(conflitos?.gatesSemPortaria ?? 0)),
    isoDup: Number(prob?.isoDuplicadoEmSolicitacoesAtivas ?? 0),
    saidasRuins: Math.max(Number(prob?.saidasSemGateOuPatio ?? 0), Number(conflitos?.saidasSemGateOuPatio ?? 0)),
    tentativas403: Number(conflitos?.tentativas403PorEscopo ?? 0),
  });

  const satFromCap = Number(cap?.fatorSaturacaoPct ?? 0);
  const perfEstr = perf?.estrategicos as { ocupacaoPatioPercent?: number | null } | undefined;
  const sat = satFromCap || Number(perfEstr?.ocupacaoPatioPercent ?? 0) || 0;

  const estr = perf?.estrategicos as { taxaGargaloDetectado?: boolean; taxaRetrabalho?: number | null } | undefined;
  const taxaGargalo = Boolean(estr?.taxaGargaloDetectado);
  const retr = Number(estr?.taxaRetrabalho ?? 0);
  const estadiaCrit = Number(sla?.unidadesComEstadiaCritica ?? 0);

  const band = riskBandFromTelemetry({ saturacaoPct: sat, taxaGargalo, violacoes: vb, estadiaCritica: estadiaCrit });
  const cicloMin = (cap?.cicloMedioMinutos ?? null) as number | null;

  const mode = globalTerminalMode({
    saturacaoPct: sat,
    taxaGargalo,
    violacoes: vb,
    cicloMedMin: cicloMin,
    estadiaCritica: estadiaCrit,
  });

  const tpE = perf?.estrategicos as {
    throughputPortaria?: number | null;
    throughputGate?: number | null;
    throughputPatio?: number | null;
  } | undefined;
  const tpPortaria = Number(tpE?.throughputPortaria ?? cap?.capacidadePortariaUnidadesPorHoraMedia ?? 0) || 0;
  const tpGate = Number(tpE?.throughputGate ?? cap?.capacidadeGateUnidadesPorHoraMedia ?? 0) || 0;
  const tpPatio = Number(tpE?.throughputPatio ?? 0) || 0;

  const relTotal = Number((args.rel as { total?: number } | null)?.total ?? 0);

  const pHoras =
    (args.proj as { horizonteHoras?: number; horas?: number } | null)?.horizonteHoras ??
    (args.proj as { horas?: number } | null)?.horas ??
    null;
  const pPct = (args.proj as { saturacaoPrevistaPct?: number } | null)?.saturacaoPrevistaPct ?? null;
  let projLabel: string | null = null;
  if (pPct != null && Number.isFinite(pPct)) {
    projLabel = `Projeção: ~${Number(pPct).toFixed(0)}% sat.`;
    if (pHoras != null) projLabel += ` (${pHoras}h)`;
  }

  return {
    filaLens,
    sat,
    taxaGargalo,
    retr,
    vb,
    mode,
    band,
    tpPortaria,
    tpGate,
    tpPatio,
    cicloMin,
    estadiaCrit,
    relTotal,
    projLabel,
  };
}
