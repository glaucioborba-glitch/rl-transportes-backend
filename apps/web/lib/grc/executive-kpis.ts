import type { ControlRowEfficacy, RiskRegisterRow } from "./types";

export type ClientStressRow = {
  clienteId: string;
  clienteNome: string;
  score: number;
  prioridadeMax: "alta" | "media" | "baixa" | "—";
  motivos: string[];
};

/** % de controles marcados efetivos na matriz COSO (local). */
export function pctControlesEfetivos(controls: ControlRowEfficacy[]): number {
  if (!controls.length) return 0;
  const ok = controls.filter((c) => c.eficacia === "efetivo").length;
  return Math.round((ok / controls.length) * 100);
}

/** % de riscos no registro com nível ≥ 4 (faixa moderada a crítica, heat 1–25). */
export function pctRiscosModeradosOuCriticos(risks: RiskRegisterRow[]): number {
  if (!risks.length) return 0;
  const hi = risks.filter((r) => r.nivel >= 4).length;
  return Math.round((hi / risks.length) * 100);
}

/**
 * Maturidade ISO 31000 heurística (0–100): cadastro, tratamentos e diversidade de categorias.
 */
export function iso31000MaturityPct(risks: RiskRegisterRow[], treatmentCount: number): number {
  if (!risks.length) return 35;
  let s = 35;
  s += Math.min(25, risks.length * 4);
  s += Math.min(20, treatmentCount * 5);
  const cats = new Set(risks.map((r) => r.categoria));
  s += Math.min(15, cats.size * 5);
  return Math.min(100, s);
}

/** Pontuação de integridade operacional 0–100 (100 = melhor). */
export function integrityOperationalScore(args: {
  gatesSemPortaria: number;
  saidasSemGateOuPatio: number;
  isoDuplicado: number;
  tentativas403: number;
  statusInconsistentes: number;
  estadiaCritica: number;
  ocupacaoPatioPct: number | null;
  taxaGargalo: boolean;
}): number {
  let s = 100;
  s -= Math.min(22, args.gatesSemPortaria * 4);
  s -= Math.min(18, args.saidasSemGateOuPatio * 4);
  s -= Math.min(18, args.isoDuplicado * 3);
  s -= Math.min(15, args.tentativas403 * 3);
  s -= Math.min(12, args.statusInconsistentes * 2);
  s -= Math.min(14, args.estadiaCritica * 2);
  const oc = args.ocupacaoPatioPct ?? 0;
  if (oc >= 90) s -= 12;
  else if (oc >= 80) s -= 8;
  else if (oc >= 70) s -= 4;
  if (args.taxaGargalo) s -= 8;
  return Math.max(0, Math.min(100, Math.round(s)));
}

function priW(p: string | undefined): number {
  if (p === "alta") return 4;
  if (p === "media") return 2;
  if (p === "baixa") return 1;
  return 1;
}

/** Ranking por estresse comercial + volume (dados reais de recomendações e ranking do dashboard). */
export function rankClientsByStress(
  comRec: Record<string, unknown> | null,
  rankingVol: { clienteId: string; clienteNome: string; solicitacoesNoPeriodo: number }[] | undefined,
): ClientStressRow[] {
  const recs = (comRec?.recomendacoes as Record<string, unknown>[] | undefined) ?? [];
  const map = new Map<string, { nome: string; score: number; motivos: string[]; pmax: number }>();

  for (const r of recs) {
    const id = r.clienteId != null ? String(r.clienteId) : "";
    if (!id) continue;
    const nome = r.clienteNome != null ? String(r.clienteNome) : id;
    const w = priW(r.prioridade as string);
    const tit = String(r.titulo ?? "");
    const cur = map.get(id) ?? { nome, score: 0, motivos: [] as string[], pmax: 0 };
    cur.score += w * 3;
    cur.pmax = Math.max(cur.pmax, w);
    if (tit && !cur.motivos.includes(tit)) cur.motivos.push(tit);
    map.set(id, cur);
  }

  const volById = new Map((rankingVol ?? []).map((x) => [x.clienteId, x]));

  for (const [id, v] of Array.from(map.entries())) {
    const vol = volById.get(id);
    if (vol && vol.solicitacoesNoPeriodo > 5) {
      v.score += Math.min(12, Math.round(Math.log10(vol.solicitacoesNoPeriodo) * 8));
    }
  }

  const priLabel = (p: number): "alta" | "media" | "baixa" | "—" => {
    if (p >= 4) return "alta";
    if (p >= 2) return "media";
    if (p >= 1) return "baixa";
    return "—";
  };

  return Array.from(map.entries())
    .map(([clienteId, v]) => ({
      clienteId,
      clienteNome: v.nome,
      score: v.score,
      prioridadeMax: priLabel(v.pmax),
      motivos: v.motivos.slice(0, 6),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 15);
}

export type ReputationBreakdown = {
  score: number;
  drivers: { label: string; delta: number; hint: string }[];
  suggestions: string[];
};

/** Score reputacional 0–100 (100 = melhor percepção estimada). Heurística front-only. */
export function computeReputationScore(args: {
  integrityScore: number;
  pctRiscoElevado: number;
  recsAltaPrioridade: number;
  estadiaCritica: number;
  inadSignals: number;
  margemRuimSignals: number;
}): ReputationBreakdown {
  let score = 72;
  const drivers: ReputationBreakdown["drivers"] = [];

  const integAdj = (args.integrityScore - 50) * 0.35;
  score += integAdj;
  drivers.push({
    label: "Integridade operacional",
    delta: Math.round(integAdj),
    hint: "Violações de fluxo e escopo.",
  });

  const riskAdj = -args.pctRiscoElevado * 0.25;
  score += riskAdj;
  drivers.push({
    label: "Riscos registrados elevados",
    delta: Math.round(riskAdj),
    hint: "% de riscos moderados/críticos no registro local.",
  });

  const recAdj = -Math.min(18, args.recsAltaPrioridade * 2.5);
  score += recAdj;
  drivers.push({
    label: "Alertas comerciais (alta)",
    delta: Math.round(recAdj),
    hint: "Recomendações prioritárias no período.",
  });

  const estAdj = -Math.min(14, args.estadiaCritica * 2);
  score += estAdj;
  drivers.push({
    label: "Estadia crítica no pátio",
    delta: Math.round(estAdj),
    hint: "SLA e atrasos crônicos percebidos.",
  });

  const inadAdj = -Math.min(12, args.inadSignals * 3);
  score += inadAdj;
  drivers.push({
    label: "Sinais de crédito / inadimplência",
    delta: Math.round(inadAdj),
    hint: "Texto em recomendações comerciais.",
  });

  const margAdj = -Math.min(10, args.margemRuimSignals * 2);
  score += margAdj;
  drivers.push({
    label: "Margens sob pressão",
    delta: Math.round(margAdj),
    hint: "Recomendações de margem comprimida.",
  });

  score = Math.max(18, Math.min(96, Math.round(score)));

  const suggestions: string[] = [];
  if (args.integrityScore < 65) suggestions.push("Revisar SLAs operacionais e checkpoints portaria→saída com clientes sensíveis.");
  if (args.recsAltaPrioridade > 2) suggestions.push("Renegociar contratos ou precificação com clientes com múltiplos alertas comerciais.");
  if (args.inadSignals > 0) suggestions.push("Fortalecer política de crédito e cobrança; comunicar transparência aos tomadores.");
  if (args.margemRuimSignals > 2) suggestions.push("Avaliar aumento de preço mínimo ou pacotes com fee fixo em contas de baixa margem.");
  if (args.estadiaCritica > 0) suggestions.push("Limitar volume prometido em janelas de pico até normalizar dwell time.");
  if (!suggestions.length) suggestions.push("Manter ritmo de monitoramento; reforçar narrativa ESG/compliance nas interações-chave.");

  return { score, drivers, suggestions };
}

export function countApiRecords(d: unknown): number | null {
  if (d == null) return null;
  if (Array.isArray(d)) return d.length;
  if (typeof d === "object" && "data" in d && Array.isArray((d as { data: unknown }).data)) {
    return (d as { data: unknown[] }).data.length;
  }
  return null;
}
