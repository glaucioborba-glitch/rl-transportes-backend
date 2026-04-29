/** Digital Twin — tipos e derivação pura (somente front). */

export type TwinRiskBand = "normal" | "semi" | "crit" | "overload";

export type TwinGlobalMode = "normal" | "atrasado" | "congestionado" | "critico";

export type MappedQuadra = {
  id: string;
  label: string;
  ocupacao: number;
  dwellProxyMin: number | null;
  risk: TwinRiskBand;
};

export function violacoesCount(args: {
  gatesSemPortaria: number;
  isoDup: number;
  saidasRuins: number;
  tentativas403: number;
}): number {
  return args.gatesSemPortaria + args.isoDup + args.saidasRuins + args.tentativas403;
}

export function riskBandFromTelemetry(args: {
  saturacaoPct: number;
  taxaGargalo: boolean;
  violacoes: number;
  estadiaCritica: number;
}): TwinRiskBand {
  if (args.violacoes > 0 || args.estadiaCritica > 2) return "overload";
  if (args.taxaGargalo || args.saturacaoPct >= 92) return "crit";
  if (args.saturacaoPct >= 75) return "semi";
  return "normal";
}

export function globalTerminalMode(args: {
  saturacaoPct: number;
  taxaGargalo: boolean;
  violacoes: number;
  cicloMedMin: number | null;
  estadiaCritica: number;
}): TwinGlobalMode {
  if (args.violacoes > 0 || args.saturacaoPct >= 95 || (args.taxaGargalo && args.saturacaoPct >= 80)) return "critico";
  if (args.taxaGargalo || args.saturacaoPct >= 82 || (args.cicloMedMin != null && args.cicloMedMin > 180)) return "congestionado";
  if (args.saturacaoPct >= 68 || args.estadiaCritica > 0 || (args.cicloMedMin != null && args.cicloMedMin > 120)) return "atrasado";
  return "normal";
}

/** Agrega fila de pátio por quadra + preenche slots vazios até quadrasDistintas. */
export function mapQuadrasFromDashboard(args: {
  filaPatio: {
    quadra?: string | null;
    quantidadeUnidades?: number;
    ordenadoPor?: string;
    solicitacaoId?: string;
  }[];
  quadrasDistintas: number;
  slotsPorQuadraEstimado: number;
  idadeMediaEstadiaHoras: number | null;
}): MappedQuadra[] {
  const byQ = new Map<string, { u: number; oldest: number }>();
  const now = Date.now();
  for (const row of args.filaPatio) {
    const q = (row.quadra && String(row.quadra).trim()) || "—";
    const n = Math.max(0, row.quantidadeUnidades ?? 1);
    const t = row.ordenadoPor ? new Date(row.ordenadoPor).getTime() : now;
    const cur = byQ.get(q) ?? { u: 0, oldest: now };
    cur.u += n;
    if (t < cur.oldest) cur.oldest = t;
    byQ.set(q, cur);
  }

  const nQuad = Math.max(1, args.quadrasDistintas || 6);
  const fromFila = Array.from(byQ.keys()).filter((k) => k && k !== "—");
  const labels: string[] =
    fromFila.length > 0
      ? fromFila.slice(0, Math.max(fromFila.length, nQuad))
      : Array.from({ length: nQuad }, (_, i) => `Q${i + 1}`);
  if (fromFila.length < nQuad && fromFila.length > 0) {
    for (let i = 1; labels.length < nQuad && i <= nQuad + 5; i++) {
      const q = `Q${i}`;
      if (!labels.includes(q)) labels.push(q);
    }
  }

  const cap = Math.max(1, args.slotsPorQuadraEstimado);
  const estadiaH = args.idadeMediaEstadiaHoras ?? 0;

  return labels.map((label) => {
    const row = byQ.get(label) ?? { u: 0, oldest: now };
    const sat = Math.min(100, (row.u / cap) * 100);
    const dwellMin = row.u > 0 ? Math.max(0, (now - row.oldest) / 60000) : null;
    const risk: TwinRiskBand =
      sat >= 92 ? "crit" : sat >= 78 ? "semi" : estadiaH > 48 && label !== "—" ? "semi" : "normal";
    return {
      id: label,
      label,
      ocupacao: row.u,
      dwellProxyMin: dwellMin,
      risk,
    };
  });
}

export function bandColorCss(b: TwinRiskBand): { stroke: string; fill: string; glow: string } {
  switch (b) {
    case "normal":
      return { stroke: "#34d399", fill: "rgba(52,211,153,0.12)", glow: "rgba(52,211,153,0.35)" };
    case "semi":
      return { stroke: "#fbbf24", fill: "rgba(251,191,36,0.12)", glow: "rgba(251,191,36,0.4)" };
    case "crit":
      return { stroke: "#f87171", fill: "rgba(248,113,113,0.15)", glow: "rgba(248,113,113,0.45)" };
    case "overload":
    default:
      return { stroke: "#c084fc", fill: "rgba(192,132,252,0.18)", glow: "rgba(168,85,247,0.55)" };
  }
}

export function modeLabel(m: TwinGlobalMode): string {
  switch (m) {
    case "normal":
      return "Normal";
    case "atrasado":
      return "Atrasado";
    case "congestionado":
      return "Congestionado";
    case "critico":
    default:
      return "Crítico";
  }
}
