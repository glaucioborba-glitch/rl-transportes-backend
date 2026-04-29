import type { AuditRow } from "@/components/ssma/audit-security-table";
import type { WatchdogLevel } from "@/lib/aog/core-logic";

/** Discipline Operational Index 0–100 (100 = mais disciplinado) */
export function computeDOI(auditRows: AuditRow[], usersCount: number | null): { score: number; factors: string[] } {
  const factors: string[] = [];
  if (!auditRows.length) {
    factors.push("Sem eventos de auditoria no recorte — DOI neutro.");
    return { score: 72, factors };
  }

  const byUser = new Map<string, number>();
  for (const r of auditRows) {
    const u = r.usuario ?? "unknown";
    byUser.set(u, (byUser.get(u) ?? 0) + 1);
  }
  const counts = Array.from(byUser.values()).filter((n) => n > 2);
  const avg = counts.reduce((a, b) => a + b, 0) / Math.max(1, counts.length);
  const varI =
    counts.length > 1
      ? counts.reduce((s, n) => s + Math.pow(n - avg, 2), 0) / counts.length
      : 0;
  let score = 82 - Math.min(40, Math.sqrt(varI) * 3);
  if (varI > 200) factors.push("Alta dispersão de eventos por operador — disciplina heterogênea.");
  if (varI < 30) factors.push("Distribuição relativamente uniforme entre atores.");

  const deletes = auditRows.filter((r) => String(r.acao).toUpperCase().includes("DELETE")).length;
  score -= Math.min(25, deletes * 2);
  if (deletes > 2) factors.push("Exclusões na trilha reduzem DOI.");

  const nUsers = usersCount ?? 0;
  if (nUsers > 0 && auditRows.length / nUsers > 8) {
    score -= 8;
    factors.push("Volume de auditoria alto por colaborador cadastrado.");
  }

  score = Math.max(15, Math.min(100, Math.round(score)));
  return { score, factors };
}

export type AuditClassified = {
  id: string;
  bucket: "estrutural" | "operacional" | "sensivel" | "outro";
  priority: number;
  summary: string;
};

export function classifyAuditEvents(rows: AuditRow[]): AuditClassified[] {
  return rows.slice(0, 80).map((r, i) => {
    const ac = String(r.acao).toUpperCase();
    const tab = r.tabela.toLowerCase();
    let bucket: AuditClassified["bucket"] = "outro";
    if (["users", "gates", "faturamentos", "boletos"].some((t) => tab.includes(t))) bucket = "estrutural";
    else if (tab.includes("solicit") || tab.includes("unidades") || tab.includes("patio")) bucket = "operacional";
    else if (tab.includes("client") || tab.includes("contr")) bucket = "sensivel";

    let priority = 2;
    if (ac.includes("DELETE")) priority = 5;
    else if (ac.includes("UPDATE") && bucket === "estrutural") priority = 4;
    else if (bucket === "sensivel") priority = 3;

    return {
      id: r.id || `row-${i}`,
      bucket,
      priority,
      summary: `${r.acao} · ${r.tabela}${r.usuario ? ` · ${r.usuario}` : ""}`,
    };
  });
}

export type BehaviorFlag = { kind: "manual" | "mudanca" | "recorrencia"; text: string; level: WatchdogLevel };

export function behaviorHeuristics(rows: AuditRow[]): BehaviorFlag[] {
  const flags: BehaviorFlag[] = [];
  const updates = rows.filter((r) => String(r.acao).toUpperCase().includes("UPDATE")).length;
  if (updates > 50) {
    flags.push({
      kind: "manual",
      level: "atencao",
      text: "Alto volume de UPDATE — possível manipulação manual intensiva.",
    });
  }

  const byMinute = new Map<string, number>();
  for (const r of rows.slice(0, 200)) {
    const d = r.createdAt.slice(0, 16);
    byMinute.set(d, (byMinute.get(d) ?? 0) + 1);
  }
  const burst = Array.from(byMinute.values()).some((n) => n >= 12);
  if (burst) {
    flags.push({
      kind: "mudanca",
      level: "grave",
      text: "Rajadas de eventos no mesmo minuto — mudanças abruptas.",
    });
  }

  const perUser = new Map<string, number>();
  for (const r of rows) {
    if (r.usuario) perUser.set(r.usuario, (perUser.get(r.usuario) ?? 0) + 1);
  }
  for (const [u, n] of Array.from(perUser.entries())) {
    if (n >= 35) {
      flags.push({
        kind: "recorrencia",
        level: "atencao",
        text: `Recorrência elevada para ${u} (${n} eventos).`,
      });
      break;
    }
  }

  return flags.slice(0, 6);
}

export type TriadDiagnosis = "humano" | "processo" | "saturacao" | "sistemico";

export function triageProcessPersonTime(args: {
  satPct: number;
  retrabalho: number;
  doi: number;
  auditVarianceHigh: boolean;
}): { primary: TriadDiagnosis; lines: string[] } {
  const lines: string[] = [];
  let primary: TriadDiagnosis = "processo";

  if (args.satPct > 82) {
    primary = "saturacao";
    lines.push("Saturação dominante — sintoma sistêmico de capacidade.");
  } else if (args.doi < 45 || args.auditVarianceHigh) {
    primary = "humano";
    lines.push("DOI baixo ou dispersão alta — foco em supervisão e treino.");
  } else if (args.retrabalho > 0.14) {
    primary = "processo";
    lines.push("Retrabalho elevado — processo ou especificação ambígua.");
  } else {
    primary = "sistemico";
    lines.push("Sinais mistos — tratar como interação sistêmica (tooling + fila + regra).");
  }

  return { primary, lines };
}
