import type { CatalogRiskItem, IncidentRecord, RiskLevel } from "./types";

function levelToProb(r: RiskLevel): number {
  if (r === "alto") return 4;
  if (r === "medio") return 3;
  return 2;
}

function sevFromCounts(n: number): number {
  if (n >= 10) return 5;
  if (n >= 5) return 4;
  if (n >= 2) return 3;
  if (n >= 1) return 2;
  return 1;
}

export function scoreRisco(prob: number, sev: number): number {
  return Math.min(25, Math.round(prob * sev));
}

/** Catálogo unificado: violações painel + performance + incidentes locais (sem rota IA). */
export function buildTerminalRiskCatalog(args: {
  conflitos?: {
    gatesSemPortaria?: number;
    saidasSemGateOuPatio?: number;
    unidadesComISORepetido?: number;
    tentativas403PorEscopo?: number;
  } | null;
  gargalosPerf?: {
    violacoesGateSemPortaria?: number;
    violacoesSaidaSemCompleto?: number;
    isoDuplicado?: number;
  } | null;
  estrategicos?: {
    ocupacaoPatioPercent?: number | null;
    taxaGargaloDetectado?: boolean;
    taxaRetrabalho?: number | null;
    throughputPortaria?: number | null;
    throughputGate?: number | null;
  } | null;
  relatorioTotalSolicitacoes?: number | null;
  incidents: IncidentRecord[];
}): CatalogRiskItem[] {
  const out: CatalogRiskItem[] = [];
  const c = args.conflitos ?? {};
  const g = args.gargalosPerf ?? {};

  if ((c.gatesSemPortaria ?? 0) > 0) {
    const n = c.gatesSemPortaria ?? 0;
    out.push({
      id: "dash-gate-port",
      titulo: "Gate sem portaria (dashboard)",
      fonte: "GET /dashboard",
      probabilidade: Math.min(5, 2 + sevFromCounts(n) - 1),
      severidade: sevFromCounts(n),
      score: 0,
      nota: `${n} ocorrências no período.`,
    });
  }
  if ((c.saidasSemGateOuPatio ?? 0) > 0) {
    const n = c.saidasSemGateOuPatio ?? 0;
    out.push({
      id: "dash-saida",
      titulo: "Saída sem gate/pátio",
      fonte: "GET /dashboard",
      probabilidade: Math.min(5, 1 + sevFromCounts(n)),
      severidade: Math.max(2, sevFromCounts(n) - 1),
      score: 0,
      nota: `${n} registros.`,
    });
  }
  if ((c.unidadesComISORepetido ?? 0) > 0) {
    const n = c.unidadesComISORepetido ?? 0;
    out.push({
      id: "dash-iso",
      titulo: "ISO duplicado em solicitações",
      fonte: "GET /dashboard",
      probabilidade: Math.min(5, 2 + Math.floor(n / 2)),
      severidade: Math.min(5, 2 + n),
      score: 0,
      nota: `${n} unidades.`,
    });
  }
  if ((c.tentativas403PorEscopo ?? 0) > 0) {
    const n = c.tentativas403PorEscopo ?? 0;
    out.push({
      id: "dash-403",
      titulo: "Tentativas fora de escopo (403)",
      fonte: "GET /dashboard",
      probabilidade: Math.min(5, 2 + sevFromCounts(n)),
      severidade: 4,
      score: 0,
      nota: `${n} eventos.`,
    });
  }

  if ((g.violacoesGateSemPortaria ?? 0) > 0) {
    const n = g.violacoesGateSemPortaria ?? 0;
    out.push({
      id: "perf-gate",
      titulo: "Violações gate sem portaria (performance)",
      fonte: "GET /dashboard-performance",
      probabilidade: Math.min(5, 2 + sevFromCounts(n)),
      severidade: sevFromCounts(n),
      score: 0,
    });
  }
  if ((g.isoDuplicado ?? 0) > 0) {
    const n = g.isoDuplicado ?? 0;
    out.push({
      id: "perf-iso",
      titulo: "ISO duplicado (agregado performance)",
      fonte: "GET /dashboard-performance",
      probabilidade: 3,
      severidade: sevFromCounts(n),
      score: 0,
    });
  }

  const oc = args.estrategicos?.ocupacaoPatioPercent ?? 0;
  if (oc >= 70) {
    out.push({
      id: "sat-patio",
      titulo: "Saturação elevada do pátio",
      fonte: "GET /dashboard-performance",
      probabilidade: oc >= 90 ? 5 : 4,
      severidade: oc >= 90 ? 5 : 4,
      score: 0,
      nota: `${oc.toFixed(0)}% ocupação referencial.`,
    });
  }

  if (args.estrategicos?.taxaGargaloDetectado) {
    out.push({
      id: "gargalo-fila",
      titulo: "Gargalo detectado (filas acima do limite)",
      fonte: "GET /dashboard-performance",
      probabilidade: 4,
      severidade: 4,
      score: 0,
    });
  }

  const thrP = args.estrategicos?.throughputPortaria ?? null;
  const thrG = args.estrategicos?.throughputGate ?? null;
  if (thrP != null && thrP < 8 && thrG != null && thrG < 8) {
    out.push({
      id: "prod-baixa",
      titulo: "Produtividade baixa (portaria e gate)",
      fonte: "GET /dashboard-performance",
      probabilidade: 3,
      severidade: 3,
      score: 0,
      nota: "Throughput conjunto abaixo de limiar heurístico.",
    });
  } else if (thrP != null && thrP < 6) {
    out.push({
      id: "prod-port",
      titulo: "Vazão reduzida na portaria",
      fonte: "GET /dashboard-performance",
      probabilidade: 3,
      severidade: 3,
      score: 0,
    });
  }

  const vol = args.relatorioTotalSolicitacoes ?? 0;
  if (vol > 800 && oc > 55) {
    out.push({
      id: "stress-vol",
      titulo: "Stress operacional (volume × ocupação)",
      fonte: "GET /relatorios/operacional/solicitacoes",
      probabilidade: 4,
      severidade: 3,
      score: 0,
      nota: `~${vol} solicitações no recorte.`,
    });
  }

  for (const inc of args.incidents) {
    const prob = levelToProb(inc.riscoPercebido);
    const sev = inc.riscoPercebido === "alto" ? 5 : inc.riscoPercebido === "medio" ? 3 : 2;
    out.push({
      id: `inc-${inc.id}`,
      titulo: `Incidente local: ${inc.tipo.replace("_", " ")} @ ${inc.local}`,
      fonte: "localStorage",
      probabilidade: prob,
      severidade: sev,
      score: 0,
      nota: inc.descricao.slice(0, 120),
    });
  }

  return out.map((r) => ({ ...r, score: scoreRisco(r.probabilidade, r.severidade) })).sort((a, b) => b.score - a.score);
}

/** Score 0–100 por quadra (i,j) a partir de ocupação e incidentes no pátio. */
export function patioCellRisk(
  row: number,
  col: number,
  ocupacaoPct: number,
  incidentsPatio: number,
  catalogMaxScore: number,
): number {
  const spatial = ((Math.sin(row * 2.1 + col * 1.7) + 1) / 2) * 22;
  const sat = (ocupacaoPct / 100) * 35;
  const inc = Math.min(30, incidentsPatio * 6);
  const sys = (catalogMaxScore / 25) * 18;
  return Math.min(100, Math.round(spatial + sat + inc + sys));
}

export function riskToHeatLevel(score: number): "baixo" | "moderado" | "critico" {
  if (score >= 70) return "critico";
  if (score >= 40) return "moderado";
  return "baixo";
}
