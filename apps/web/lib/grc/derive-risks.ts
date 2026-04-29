import type { MatrixPlotPoint, RiskRegisterRow } from "./types";

export function plotsFromRegister(rows: RiskRegisterRow[]): MatrixPlotPoint[] {
  return rows.map((r) => ({
    id: `loc-${r.id}`,
    label: r.risco,
    p: r.probabilidade,
    i: r.impacto,
    source: "local",
  }));
}

export function mergeRiskPlots(...arrays: MatrixPlotPoint[][]): MatrixPlotPoint[] {
  const m = new Map<string, MatrixPlotPoint>();
  for (const arr of arrays) {
    for (const p of arr) m.set(p.id, p);
  }
  return Array.from(m.values());
}

function numLike(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Participação % da receita do período nos 5 maiores clientes (`porCliente`). */
export function top5ReceitaPercent(faturamentoResumo: Record<string, unknown> | null | undefined): number {
  const porCliente = faturamentoResumo?.porCliente;
  if (!Array.isArray(porCliente) || porCliente.length === 0) return 0;
  const vals = porCliente.map((p) => numLike((p as Record<string, unknown>).valor)).filter((x) => x > 0);
  if (!vals.length) return 0;
  const tot = vals.reduce((a, b) => a + b, 0);
  const top5 = [...vals].sort((a, b) => b - a).slice(0, 5).reduce((a, b) => a + b, 0);
  return tot > 0 ? (top5 / tot) * 100 : 0;
}

export function deriveRiskPlots(args: {
  conflitos?: Record<string, number> | null;
  ocupacaoPatio?: number | null;
  taxaGargalo?: boolean;
  retrabalho?: number | null;
  forecastInad?: number | null;
  margemMedia?: number | null;
  top5ReceitaPct?: number;
}): MatrixPlotPoint[] {
  const out: MatrixPlotPoint[] = [];
  if ((args.conflitos?.gatesSemPortaria ?? 0) > 0) {
    out.push({ id: "api-gate", label: "Gate sem portaria", p: 4, i: 4, source: "api" });
  }
  if ((args.conflitos?.unidadesComISORepetido ?? 0) > 0) {
    out.push({ id: "api-iso", label: "ISO duplicado", p: 3, i: 4, source: "api" });
  }
  if ((args.conflitos?.tentativas403PorEscopo ?? 0) > 0) {
    out.push({ id: "api-403", label: "Fora de escopo / 403", p: 4, i: 5, source: "api" });
  }
  if (args.taxaGargalo) {
    out.push({ id: "api-garg", label: "Gargalo (fila)", p: 4, i: 4, source: "api" });
  }
  const oc = args.ocupacaoPatio ?? 0;
  if (oc >= 85) {
    out.push({ id: "api-sat", label: "Saturação pátio", p: Math.min(5, 3 + Math.floor((oc - 70) / 10)), i: 4, source: "api" });
  } else if (oc >= 70) {
    out.push({ id: "api-sat2", label: "Saturação moderada", p: 3, i: 3, source: "api" });
  }
  if ((args.retrabalho ?? 0) > 0.2) {
    out.push({ id: "api-ret", label: "Retrabalho elevado", p: 3, i: 3, source: "api" });
  }
  if (args.forecastInad != null && args.forecastInad > 12) {
    out.push({ id: "api-inad", label: "Inadimplência proj.", p: 4, i: Math.min(5, Math.floor(args.forecastInad / 5)), source: "api" });
  }
  if (args.margemMedia != null && args.margemMedia < 12) {
    out.push({ id: "api-marg", label: "Margem comprimida", p: 3, i: 4, source: "api" });
  }
  if ((args.top5ReceitaPct ?? 0) > 55) {
    out.push({ id: "api-conc", label: "Concentração receita top5", p: 3, i: 4, source: "api" });
  }
  return out;
}

export function plotsFromComercialRecomendacoes(recs: unknown[]): MatrixPlotPoint[] {
  const rows = (Array.isArray(recs) ? recs : []) as Record<string, unknown>[];
  const out: MatrixPlotPoint[] = [];
  const marg = rows.filter((r) => String(r.titulo ?? "").toLowerCase().includes("margem comprimida"));
  if (marg.length >= 1) {
    out.push({
      id: "rec-marg",
      label: `Margens comprimidas (${marg.length} cliente(s) no período)`,
      p: Math.min(5, 2 + Math.min(3, marg.length)),
      i: 4,
      source: "api",
    });
  }
  const inad = rows.filter(
    (r) =>
      String(r.titulo ?? "")
        .toLowerCase()
        .match(/boleto|inadimpl|pagamento/) ||
      String(r.descricao ?? "")
        .toLowerCase()
        .match(/boleto|inadimpl/),
  );
  if (inad.length >= 1) {
    out.push({
      id: "rec-inad",
      label: `Inadimplência / boletos (${inad.length} alerta(s))`,
      p: 4,
      i: Math.min(5, 3 + Math.min(2, inad.length)),
      source: "api",
    });
  }
  const cauda = rows.filter((r) => String(r.titulo ?? "").includes("Curva C"));
  if (cauda.length >= 2) {
    out.push({
      id: "rec-abc",
      label: "Curva ABC degradada (vários em classe C)",
      p: 3,
      i: 3,
      source: "api",
    });
  }
  return out;
}

export function nivelRisco(impacto: number, prob: number): number {
  return Math.min(25, Math.max(1, Math.round(impacto * prob)));
}

export function heatClass(n: number): string {
  if (n >= 16) return "bg-black text-rose-100 ring-1 ring-red-600";
  if (n >= 10) return "bg-red-950/80 text-red-100";
  if (n >= 4) return "bg-amber-900/60 text-amber-50";
  return "bg-emerald-900/45 text-emerald-100";
}
