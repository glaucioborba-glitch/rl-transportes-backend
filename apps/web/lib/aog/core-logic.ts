import type { AuditRow } from "@/components/ssma/audit-security-table";

export type WatchdogLevel = "normal" | "atencao" | "grave" | "critico";

export function classifyWatchdog(args: {
  violacoes: number;
  satPct: number;
  retrabalho: number;
  estadiaCritica: number;
  t403: number;
  taxaGargalo: boolean;
  auditRows: AuditRow[];
}): { level: WatchdogLevel; signals: string[] } {
  const signals: string[] = [];
  if (args.violacoes > 0) signals.push(`${args.violacoes} violação(ões) operacional(is) ativa(s)`);
  if (args.t403 > 0) signals.push(`${args.t403} tentativa(s) 403 registradas (escopo)`);
  if (args.retrabalho > 0.14) signals.push(`Retrabalho crítico ~${(args.retrabalho * 100).toFixed(1)}%`);
  if (args.estadiaCritica > 0) signals.push(`${args.estadiaCritica} unidade(s) com estadia SLA crítica`);
  if (args.taxaGargalo) signals.push("Gargalo detectado no desempenho");
  if (args.satPct > 88) signals.push(`Saturação pátio elevada (${args.satPct.toFixed(0)}%)`);

  const recent = args.auditRows.filter((r) => {
    const t = new Date(r.createdAt).getTime();
    return Date.now() - t < 48 * 3600 * 1000;
  });
  const deletes = recent.filter((r) => String(r.acao).toUpperCase().includes("DELETE")).length;
  if (deletes >= 3) signals.push(`${deletes} exclusões em 48h — revisar trilha`);

  let level: WatchdogLevel = "normal";
  if (args.violacoes > 0 && args.satPct > 90) level = "critico";
  else if (args.violacoes > 0 || args.satPct >= 88 || args.retrabalho > 0.16 || deletes >= 5) level = "grave";
  else if (args.satPct >= 72 || args.t403 > 3 || args.estadiaCritica > 0 || args.taxaGargalo || args.retrabalho > 0.1) {
    level = "atencao";
  }

  if (!signals.length) signals.push("Parâmetros dentro do observado — vigilância contínua ativa");

  return { level, signals };
}

export type ConformityStatus = "OK" | "WARN" | "FAIL";

export function runConformityEngine(args: {
  estadiaCritica: number;
  satPct: number;
  taxaGargalo: boolean;
  retrabalho: number;
  violacoes: number;
  throughputBalanced: boolean;
}): { overall: ConformityStatus; checks: { name: string; status: ConformityStatus; detail: string }[] } {
  const checks: { name: string; status: ConformityStatus; detail: string }[] = [];

  let sla: ConformityStatus = "OK";
  if (args.estadiaCritica > 2) sla = "FAIL";
  else if (args.estadiaCritica > 0) sla = "WARN";
  checks.push({
    name: "SLA / dwell",
    status: sla,
    detail:
      sla === "OK"
        ? "Nenhuma estadia crítica acionada."
        : sla === "WARN"
          ? "Estadias críticas pontuais — acompanhar saída."
          : "Múltiplas estadias críticas — FAIL disciplinar.",
  });

  let sat: ConformityStatus = "OK";
  if (args.satPct >= 92 || args.violacoes > 0) sat = "FAIL";
  else if (args.satPct >= 78) sat = "WARN";
  checks.push({
    name: "Limites de saturação",
    status: sat,
    detail: `Pátio ~${args.satPct.toFixed(1)}%`,
  });

  let turno: ConformityStatus = args.throughputBalanced ? "OK" : "WARN";
  if (args.taxaGargalo && !args.throughputBalanced) turno = "FAIL";
  checks.push({
    name: "Turnos dimensionados (proxy throughput)",
    status: turno,
    detail: args.throughputBalanced ? "Portaria/gate alinhados." : "Desbalanceamento P/G.",
  });

  let disc: ConformityStatus = "OK";
  if (args.retrabalho > 0.18) disc = "FAIL";
  else if (args.retrabalho > 0.1) disc = "WARN";
  checks.push({
    name: "Disciplina operacional (retrabalho)",
    status: disc,
    detail: `${(args.retrabalho * 100).toFixed(1)}% retrabalho`,
  });

  const fail = checks.filter((c) => c.status === "FAIL").length;
  const warn = checks.filter((c) => c.status === "WARN").length;
  const overall: ConformityStatus = fail > 0 ? "FAIL" : warn > 0 ? "WARN" : "OK";

  return { overall, checks };
}

export type RiskDimension = {
  key: string;
  label: string;
  score: number;
  note: string;
};

export function buildCrossRiskMatrix(args: {
  operacional: number;
  financeiro: number;
  comercial: number;
  humano: number;
  ssma: number;
  reputacional: number;
}): { dimensions: RiskDimension[]; grcIndex: number } {
  const dimensions: RiskDimension[] = [
    { key: "op", label: "Operacional", score: args.operacional, note: "Fila, saturação, NC" },
    { key: "fin", label: "Financeiro", score: args.financeiro, note: "Inadimplência, margem" },
    { key: "com", label: "Comercial", score: args.comercial, note: "Concentração, SLA cliente" },
    { key: "hum", label: "Humano", score: args.humano, note: "Auditoria, consistência" },
    { key: "ssma", label: "SSMA", score: args.ssma, note: "Incidentes proxy" },
    { key: "rep", label: "Reputacional", score: args.reputacional, note: "403 + conflitos" },
  ];
  const grcIndex = Math.round(dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length);
  return { dimensions, grcIndex };
}

export type AnomalySignal = { id: string; severity: WatchdogLevel; title: string; detail: string };

export function detectGovernanceAnomalies(args: {
  auditRows: AuditRow[];
  tpPortaria: number;
  tpGate: number;
  satPct: number;
}): AnomalySignal[] {
  const out: AnomalySignal[] = [];
  const byUser = new Map<string, number>();
  for (const r of args.auditRows) {
    const u = r.usuario ?? "—";
    byUser.set(u, (byUser.get(u) ?? 0) + 1);
  }
  for (const [u, n] of Array.from(byUser.entries())) {
    if (u !== "—" && n >= 25) {
      out.push({
        id: `u-${u}`,
        severity: "atencao",
        title: "Alta reincidência de eventos por ator",
        detail: `${u}: ${n} eventos no recorte carregado.`,
      });
    }
  }

  if (args.tpPortaria > 2 && args.tpGate > 2 && Math.abs(args.tpPortaria - args.tpGate) / Math.max(args.tpPortaria, args.tpGate) > 0.55) {
    out.push({
      id: "thr",
      severity: "atencao",
      title: "Throughput inconsistente",
      detail: "Grandes discrepâncias entre portaria e gate podem indicar gargalo ou registro incompleto.",
    });
  }

  const updates = args.auditRows.filter((r) => String(r.acao).toUpperCase().includes("UPDATE"));
  const sos = updates.filter((r) => r.tabela === "solicitacoes");
  if (sos.length >= 40) {
    out.push({
      id: "manip",
      severity: "grave",
      title: "Volume elevado de alterações em solicitações",
      detail: "Possível manipulação de status ou retrabalho intenso — revisar duplo-check.",
    });
  }

  if (args.satPct > 86 && updates.length > 60) {
    out.push({
      id: "sat-audit",
      severity: "grave",
      title: "Correlação suspeita: saturação + auditoria intensa",
      detail: "Picos simultâneos podem indicar correção reativa excessiva.",
    });
  }

  return out.slice(0, 12);
}
