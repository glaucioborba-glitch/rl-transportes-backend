import { maxGargaloProb, type IaGargaloBlob, type OperationalSnapshot } from "@/lib/ai-console/operational-snapshot";
import { modeLabel } from "@/lib/digital-twin/derive";

export type PriorityEvent = {
  rank: 1 | 2 | 3 | 4 | 5;
  title: string;
  detail: string;
};

const n = (v: number, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : "—");

export function buildStateTicker(snap: OperationalSnapshot, gar: IaGargaloBlob): string {
  const probs = (gar?.horizontes ?? [])
    .map((raw) => {
      const h = raw as Record<string, unknown>;
      const horas = Number(h.horas);
      const label = Number.isFinite(horas) ? `${horas}` : "?";
      return `${label}h:${(maxGargaloProb({ horizontes: [raw] }) * 100).toFixed(0)}%`;
    })
    .join(" · ");
  return [
    `TOC · ${modeLabel(snap.mode)}`,
    `Filas P/G/Pt/S: ${snap.filaLens.portaria}/${snap.filaLens.gate}/${snap.filaLens.patio}/${snap.filaLens.saida}`,
    `Sat ${n(snap.sat)}% · thr P/G ${n(snap.tpPortaria, 0)}/${n(snap.tpGate, 0)} u/h`,
    `Retrabalho ${n(snap.retr * 100)}% · NC ${snap.vb}`,
    probs ? `IA · ${probs}` : "IA · sem previsão de gargalo",
    snap.projLabel ?? "",
  ]
    .filter(Boolean)
    .join(" — ");
}

export function buildOperationalRecommendations(snap: OperationalSnapshot): string[] {
  const out: string[] = [];
  if (snap.vb > 0) out.push("Corrigir não conformidades antes de aumentar entrada: conferir ISO duplicado e fluxo portaria→gate.");
  if (snap.sat >= 85) out.push("Priorizar gate-out e movimentação interna em quadras mais cheias; considerar bloqueio parcial de gate-in.");
  if (snap.taxaGargalo) out.push("Gate em tensão: reforço de docas ou escalonamento de janelas no horário atual.");
  if (snap.filaLens.portaria > snap.filaLens.gate + 4) out.push("Possível congestionamento na portaria; validar cadastro/documentação antes do gate.");
  if (snap.retr > 0.12) out.push("Retrabalho elevado; revisar instruções de patio e alinhamento operador×sistema.");
  if (snap.estadiaCrit > 0) out.push(`${snap.estadiaCrit} unidade(s) com estadia crítica — acionar priorização de saída.`);
  if (!out.length) out.push("Operação dentro da faixa: manter cadência e monitorar próximo horizonte IA.");
  return out.slice(0, 6);
}

export function buildRootCausesLite(snap: OperationalSnapshot): string[] {
  const h: string[] = [];
  if (snap.sat >= 75 && snap.tpGate < snap.tpPortaria * 0.85 && snap.tpPortaria > 0) {
    h.push("Hipótese: gate mais lento que portaria — possível gargalo de inspeção/liberação.");
  }
  if (snap.filaLens.portaria > 10 && snap.filaLens.gate < 4) {
    h.push("Hipótese: pico de chegadas não absorvido ainda pelo gate.");
  }
  if (snap.sat >= 82) {
    h.push("Hipótese: quadra(s) críticas acima de faixa segura de ocupação.");
  }
  if (snap.taxaGargalo && snap.retr > 0.08) {
    h.push("Hipótese: retrabalho contribuindo para filas e tempos de ciclo.");
  }
  if (!h.length) h.push("Sem padrão anômalo forte nos indicadores agregados.");
  return h;
}

export function buildEventPriorityList(snap: OperationalSnapshot, gar: IaGargaloBlob): PriorityEvent[] {
  const list: PriorityEvent[] = [];
  const pg = maxGargaloProb(gar);

  if (snap.vb > 0) {
    list.push({ rank: 1, title: "Violações operacionais", detail: `${snap.vb} evento(s) de não conformidade ativos` });
  }
  if (pg >= 0.55) {
    list.push({ rank: 2, title: "Gargalo previsto (IA)", detail: `Prob. máx. ~${(pg * 100).toFixed(0)}% no horizonte analisado` });
  }
  if (snap.sat > 80) {
    list.push({ rank: 3, title: "Saturações elevadas", detail: `Pátio em ${n(snap.sat)}%` });
  }
  if (snap.estadiaCrit > 0) {
    list.push({ rank: 4, title: "Dwell crítico", detail: `${snap.estadiaCrit} unidade(s)` });
  }
  const anom =
    snap.tpGate > 0 && snap.tpPortaria > 0 && snap.tpGate < snap.tpPortaria * 0.5 && snap.filaLens.gate > 6;
  if (anom || snap.retr > 0.15) {
    list.push({
      rank: 5,
      title: "Produtividade anômala",
      detail: anom ? "Throughput gate muito abaixo da portaria" : `Retrabalho ${n(snap.retr * 100)}%`,
    });
  }

  list.sort((a, b) => a.rank - b.rank);
  if (!list.length) {
    list.push({ rank: 5, title: "Situação estável", detail: "Monitoramento contínuo recomendado." });
  }
  return list.slice(0, 8);
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function answerOperationalQuestion(
  q: string,
  snap: OperationalSnapshot,
  gar: IaGargaloBlob,
): { reply: string; priority: "P1" | "P2" | "P3" } {
  const t = norm(q);
  const pg = maxGargaloProb(gar);
  let priority: "P1" | "P2" | "P3" = "P3";
  if (snap.vb > 0 || snap.mode === "critico") priority = "P1";
  else if (snap.taxaGargalo || snap.sat > 82 || pg > 0.55) priority = "P2";

  if (/gargalo|bottleneck|estrangul/.test(t)) {
    return {
      priority,
      reply: `Gargalo provável: ${
        snap.taxaGargalo ? "indicador de gargalo ativo no desempenho. " : ""
      }Filas atuais portaria ${snap.filaLens.portaria}, gate ${snap.filaLens.gate}. IA (máx. prob.): ${(pg * 100).toFixed(0)}%. Recomendação: ${
        snap.taxaGargalo ? "reduzir taxa de entrada e priorizar gate-out." : "manter observação e preparar contingência no gate."
      }`,
    };
  }
  if (/colaps|colapso|lotad|satur/.test(t)) {
    const eta = snap.projLabel ? ` ${snap.projLabel}` : "";
    return {
      priority,
      reply: `Saturação do pátio ~${n(snap.sat)}%. Estado: ${modeLabel(snap.mode)}.${eta} Tendência depende de throughput gate (${n(
        snap.tpGate,
        0,
      )} u/h) vs chegadas. Recomendação: ${snap.sat > 80 ? "antecipar saídas e bloquear parcialmente gate-in." : "manter cadência atual."}`,
    };
  }
  if (/gate/.test(t) && !/portaria/.test(t)) {
    return {
      priority,
      reply: `Gate: fila ${snap.filaLens.gate}, throughput médio ~${n(snap.tpGate, 0)} u/h. ${
        snap.taxaGargalo ? "Há indicação de tensão — reforçar liberação/coordenação." : "Dentro do esperado para o corte atual — seguir monitorando."
      }`,
    };
  }
  if (/portaria|entrada/.test(t)) {
    return {
      priority,
      reply: `Portaria (gate-in): fila ${snap.filaLens.portaria}, throughput ~${n(snap.tpPortaria, 0)} u/h. ${
        snap.filaLens.portaria > 12 ? "Fila alta: validar documentação antecipada e evitar picos simultâneos." : "Fluxo controlado."
      }`,
    };
  }
  if (/risco/.test(t)) {
    return {
      priority,
      reply: `Risco operacional consolidado: modo ${modeLabel(snap.mode)}, faixa ${snap.band}, NC=${snap.vb}, retrabalho ${n(
        snap.retr * 100,
      )}%. Próximo passo: ${snap.vb > 0 ? "resolver NC primeiro." : snap.sat > 78 ? "foco em esvaziamento de pátio." : "operação em faixa segura."}`,
    };
  }
  if (/throughput|vaz(a|ã)o|fluxo/.test(t)) {
    return {
      priority,
      reply: `Throughput: portaria ${n(snap.tpPortaria, 0)} u/h, gate ${n(snap.tpGate, 0)} u/h. Ciclo médio ~${
        snap.cicloMin != null ? `${snap.cicloMin.toFixed(0)} min` : "n/d"
      }. Relatório período: ${snap.relTotal} solicitações.`,
    };
  }

  return {
    priority,
    reply: `Resumo: ${buildStateTicker(snap, gar)} · Recomendações: ${buildOperationalRecommendations(snap)[0] ?? "manter monitoramento."}`,
  };
}

/** CFO / financeiro — interpretação textual a partir de objetos já carregados */
export function answerCfoQuestion(
  q: string,
  args: {
    fin: Record<string, unknown> | null;
    ind: Record<string, unknown> | null;
    rec: Record<string, unknown> | null;
  },
): { reply: string; priority: "P1" | "P2" | "P3" } {
  const t = norm(q);
  const fin = args.fin;
  const finSnap = fin?.snapshot as { mediaTicketPorSolicitacao?: number } | undefined;
  const rent = fin?.rentabilidade as { proxyMargemOperacional?: number | null } | undefined;
  const inad = fin?.inadimplencia as {
    forecastInadimplenciaPercent?: number | null;
    forecastFaturamentoProximoMes?: number | null;
  } | undefined;
  const indData = args.ind as {
    margemMediaPct?: number | null;
    faturamentoTotal?: number;
    lucroEstimado?: number;
  } | undefined;
  const lucroPct =
    indData?.faturamentoTotal && indData.faturamentoTotal > 0
      ? ((indData.lucroEstimado ?? 0) / indData.faturamentoTotal) * 100
      : 0;
  const margem = indData?.margemMediaPct ?? lucroPct;
  const recItens = (args.rec as { recomendacoes?: { titulo?: string; descricao?: string }[] } | null)?.recomendacoes ?? [];

  let priority: "P1" | "P2" | "P3" = "P3";
  if ((inad?.forecastInadimplenciaPercent ?? 0) > 8 || margem < 10) priority = "P1";
  else if (margem < 14 || (inad?.forecastInadimplenciaPercent ?? 0) > 5) priority = "P2";

  if (/margem|lucro|rentab/.test(t)) {
    return {
      priority,
      reply: `Margem média ~${margem.toFixed(1)}%. Proxy operacional: ${Number(rent?.proxyMargemOperacional ?? 0).toFixed(2)}. ${
        margem < 12
          ? "Alerta: margem compressada — priorize renegociação em clientes de baixa rentabilidade."
          : "Faixa saudável para análise de pricing seletivo."
      }`,
    };
  }
  if (/inadimpl|pagar|atras/.test(t)) {
    return {
      priority,
      reply: `Inadimplência projetada: ${(inad?.forecastInadimplenciaPercent ?? 0).toFixed(1)}%. Forecast próximo mês: R$ ${(
        inad?.forecastFaturamentoProximoMes ?? 0
      ).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}. ${
        (inad?.forecastInadimplenciaPercent ?? 0) > 6
          ? "Recomendo cobrança ativa e revisão de limites."
          : "Risco moderado — manter ritmo de conciliação."
      }`,
    };
  }
  if (/pre(c|ç)o|pricing|elastic/.test(t)) {
    return {
      priority,
      reply: `Ticket médio ~R$ ${(finSnap?.mediaTicketPorSolicitacao ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}. Com elasticidade nos indicadores comerciais, ${
        margem < 14
          ? "subidas devem ser cirúrgicas (clientes A/B com baixo risco de fuga)."
          : "há espaço para testes de preço em faixas de menor sensibilidade."
      }`,
    };
  }
  if (/cliente|abc|concentra/.test(t)) {
    const tip = recItens[0];
    return {
      priority,
      reply: `Análise comercial: ${tip?.titulo ?? "use o painel de recomendações"}. ${
        tip?.descricao ?? "Revise curva ABC e concentração de receita para evitar dependência excessiva."
      }`,
    };
  }

  return {
    priority,
    reply: `Indicadores-chave: margem ~${margem.toFixed(1)}%, ticket médio alinhado ao período. Próxima receita prevista R$ ${(
      inad?.forecastFaturamentoProximoMes ?? 0
    ).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}. ${recItens[0]?.titulo ?? ""}`,
  };
}

export function answerStrategicQuestion(
  q: string,
  args: {
    snap: OperationalSnapshot | null;
    cenario: Record<string, unknown> | null;
    expansao: Record<string, unknown> | null;
    finMargem: number | null;
    recTitles: string[];
  },
): { reply: string; priority: "P1" | "P2" | "P3" } {
  const t = norm(q);
  const sat = args.snap?.sat ?? 0;
  const vb = args.snap?.vb ?? 0;
  let priority: "P1" | "P2" | "P3" = "P3";
  if (vb > 0 || sat > 92) priority = "P1";
  else if (sat > 82 || (args.finMargem ?? 20) < 12) priority = "P2";

  if (/roi|expand|quadra|m2|metro/.test(t)) {
    const ganho = args.expansao as { slotsAdicionaisEstimados?: number; paybackMesesProxy?: number } | undefined;
    return {
      priority,
      reply: `Expansão (proxy API): +${ganho?.slotsAdicionaisEstimados ?? "n/d"} slots, payback ~${ganho?.paybackMesesProxy ?? "n/d"} meses. Saturação hoje ~${sat.toFixed(
        0,
      )}% — ${
        sat > 75 ? "cenário favorável a avaliar capex operacional." : "avalie ROI apenas se demanda estrutural crescer."
      }`,
    };
  }
  if (/volume|cresc|demanda|20%|cen[aá]rio/.test(t)) {
    const c = args.cenario as { saturacaoPrevistaPct?: number; gargaloPrevisto?: string } | undefined;
    const satPrev =
      typeof c?.saturacaoPrevistaPct === "number" ? c.saturacaoPrevistaPct.toFixed(0) : "n/d";
    return {
      priority,
      reply: `Simulação disponível: saturação prevista ~${satPrev}%. ${c?.gargaloPrevisto ?? "Gargalo depende do mix simulado."} Combine expansão de quadras e turnos no painel de cenários.`,
    };
  }
  if (/risco estrat|diretoria|board/.test(t)) {
    return {
      priority,
      reply: `Score qualitativo: ops ${vb > 0 ? "crítico (NC)" : sat > 82 ? "tenso" : "ok"}, financeiro ${
        (args.finMargem ?? 0) < 12 ? "pressionado" : "estável"
      }. ${args.recTitles[0] ?? "Siga recomendações comerciais para diversificação."}`,
    };
  }

  return {
    priority,
    reply: `Situação integrada: terminal ${args.snap ? modeLabel(args.snap.mode) : "n/d"}, pátio ~${sat.toFixed(0)}%. ${args.recTitles.slice(0, 2).join(" · ") || "Consulte simulador de cenário para decisões de capacidade."}`,
  };
}

export function strategicRiskScore(args: {
  snap: OperationalSnapshot | null;
  finMargem: number | null;
  recCount: number;
  garProb: number;
}): { score: number; label: string } {
  let s = 20;
  const sat = args.snap?.sat ?? 0;
  s += Math.min(35, sat * 0.35);
  s += args.snap?.vb ? 25 : 0;
  if (args.snap?.taxaGargalo) s += 10;
  s += Math.min(15, args.garProb * 15);
  const m = args.finMargem ?? 18;
  if (m < 12) s += 15;
  else if (m < 14) s += 8;
  s += Math.min(10, args.recCount * 2);
  const score = Math.max(0, Math.min(100, Math.round(s)));
  const label =
    score >= 75 ? "Elevado — revisão em comitê" : score >= 55 ? "Moderado — mitigação recomendada" : "Controlado — monitorar";
  return { score, label };
}
