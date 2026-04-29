import {
  globalTerminalMode,
  riskBandFromTelemetry,
} from "@/lib/digital-twin/derive";
import type { OperationalSnapshot } from "@/lib/ai-console/operational-snapshot";

/** Usado quando o módulo não chama /dashboard — deriva telemetria só de performance + capacidade. */
export function syntheticOperationalFromPerfCap(
  perf: Record<string, unknown> | null,
  cap: Record<string, unknown> | null,
): OperationalSnapshot | null {
  if (!perf) return null;

  const filaLens = { portaria: 0, gate: 0, patio: 0, saida: 0 };

  const satFromCap = Number(cap?.fatorSaturacaoPct ?? 0);
  const perfEstr = perf.estrategicos as { ocupacaoPatioPercent?: number | null } | undefined;
  const sat = satFromCap || Number(perfEstr?.ocupacaoPatioPercent ?? 0) || 0;

  const estr = perf.estrategicos as { taxaGargaloDetectado?: boolean; taxaRetrabalho?: number | null } | undefined;
  const taxaGargalo = Boolean(estr?.taxaGargaloDetectado);
  const retr = Number(estr?.taxaRetrabalho ?? 0);
  const estadiaCrit = 0;
  const vb = 0;

  const band = riskBandFromTelemetry({ saturacaoPct: sat, taxaGargalo, violacoes: vb, estadiaCritica: estadiaCrit });
  const cicloMin = (cap?.cicloMedioMinutos ?? null) as number | null;

  const mode = globalTerminalMode({
    saturacaoPct: sat,
    taxaGargalo,
    violacoes: vb,
    cicloMedMin: cicloMin,
    estadiaCritica: estadiaCrit,
  });

  const tpE = perf.estrategicos as {
    throughputPortaria?: number | null;
    throughputGate?: number | null;
    throughputPatio?: number | null;
  } | undefined;
  const tpPortaria = Number(tpE?.throughputPortaria ?? cap?.capacidadePortariaUnidadesPorHoraMedia ?? 0) || 0;
  const tpGate = Number(tpE?.throughputGate ?? cap?.capacidadeGateUnidadesPorHoraMedia ?? 0) || 0;
  const tpPatio = Number(tpE?.throughputPatio ?? 0) || 0;

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
    relTotal: 0,
    projLabel: null,
  };
}
